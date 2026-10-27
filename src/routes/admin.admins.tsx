import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { changeAdminRole } from "@/lib/admin-role.functions";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { ShieldCheck, UserRoundPlus, UserRoundMinus } from "lucide-react";

export const Route = createFileRoute("/admin/admins")({ component: AdminsPage });

type Profile = { id: string; full_name: string; business_name: string; phone: string };

async function loadRoleProfiles(role: "admin" | "vendor") {
  const { data: roles, error: roleError } = await supabase.from("user_roles").select("user_id").eq("role", role);
  if (roleError) throw roleError;
  let ids = (roles ?? []).map((entry) => entry.user_id);
  // Legacy accounts may have both role rows. Never show an admin as a vendor
  // while the database cleanup migration/script is being applied.
  if (role === "vendor" && ids.length) {
    const { data: adminRoles, error: adminRoleError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (adminRoleError) throw adminRoleError;
    const adminIds = new Set((adminRoles ?? []).map((entry) => entry.user_id));
    ids = ids.filter((id) => !adminIds.has(id));
  }
  if (!ids.length) return [] as Profile[];
  const { data, error } = await supabase.from("profiles").select("id, full_name, business_name, phone").in("id", ids).order("full_name");
  if (error) throw error;
  return (data ?? []) as Profile[];
}

function AdminsPage() {
  const { lang } = useI18n();
  const sw = lang === "sw";
  const queryClient = useQueryClient();
  const mutateRole = useServerFn(changeAdminRole);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data: me } = useQuery({ queryKey: ["current-user-id"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null, staleTime: 5 * 60_000 });
  const { data: admins, isLoading: adminsLoading, error: adminsError } = useQuery({
    queryKey: ["admin-role-profiles", "admin"],
    queryFn: () => loadRoleProfiles("admin"),
    staleTime: 60_000,
  });
  const { data: vendors, isLoading: vendorsLoading, error: vendorsError } = useQuery({
    queryKey: ["admin-role-profiles", "vendor"],
    queryFn: () => loadRoleProfiles("vendor"),
    staleTime: 60_000,
  });
  const failureMessage = (error: unknown) => {
    const code = error instanceof Error ? error.message : "";
    if (code.includes("CANNOT_DEMOTE_SELF")) return sw ? "Huwezi kujiondoa mwenyewe kama msimamizi." : "You cannot remove your own admin access.";
    if (code.includes("LAST_ADMIN")) return sw ? "Lazima angalau msimamizi mmoja abaki." : "At least one admin must remain.";
    if (code.includes("FORBIDDEN")) return sw ? "Huna ruhusa ya kubadilisha wasimamizi." : "You are not allowed to change admins.";
    return sw ? "Mabadiliko hayakufaulu. Jaribu tena." : "The role change failed. Please try again.";
  };

  const changeRole = async (person: Profile, promote: boolean) => {
    const prompt = promote
      ? (sw
        ? `Mpe ${person.full_name || person.business_name} uwezo wa msimamizi? Ataweza kusimamia wauzaji, kuona takwimu za mfumo, na kubadilisha mipangilio ya wasimamizi na AI.`
        : `Promote ${person.full_name || person.business_name} to admin? They will be able to manage vendors, view platform statistics, and change admin and AI settings.`)
      : (sw
        ? `Ondoa uwezo wa msimamizi wa ${person.full_name || person.business_name}? Atakuwa tena muuzaji wa kawaida.`
        : `Remove admin access from ${person.full_name || person.business_name}? They will return to the vendor role.`);
    if (!window.confirm(prompt)) return;
    setBusyId(person.id);
    try {
      await mutateRole({ data: { userId: person.id, promote } });
      toast.success(promote
        ? (sw ? "Ameongezwa kama msimamizi." : "Promoted to admin.")
        : (sw ? "Uwezo wa msimamizi umeondolewa." : "Admin access removed."));
      await queryClient.invalidateQueries({ queryKey: ["admin-role-profiles"] });
    } catch (error) {
      toast.error(failureMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold md:text-3xl">{sw ? "Simamia Wasimamizi" : "Manage Admins"}</h1>
        <p className="text-sm text-muted-foreground">{sw ? "Wasimamizi wanaweza kusimamia wauzaji, takwimu za mfumo, mipangilio ya AI na akaunti za wasimamizi." : "Admins can manage vendors, platform statistics, AI settings, and admin accounts."}</p>
      </header>

      <RoleList title={sw ? "Wasimamizi wa sasa" : "Current admins"} people={admins ?? []} loading={adminsLoading} error={adminsError} empty={sw ? "Hakuna wasimamizi." : "No admins found."}
        lang={lang}
        renderAction={(person) => {
          const self = person.id === me;
          const lastAdmin = (admins?.length ?? 0) <= 1;
          return <button onClick={() => changeRole(person, false)} disabled={busyId !== null || self || lastAdmin} className="tap-target inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-sm font-semibold text-destructive disabled:opacity-40">
            <UserRoundMinus size={15} />{sw ? "Ondoa msimamizi" : "Remove Admin"}
          </button>;
        }}
        badge={(person) => person.id === me ? (sw ? "(wewe)" : "(you)") : null}
      />

      <RoleList title={sw ? "Wauzaji" : "Vendors"} people={vendors ?? []} loading={vendorsLoading} error={vendorsError} empty={sw ? "Hakuna wauzaji." : "No vendors found."}
        lang={lang}
        renderAction={(person) => <button onClick={() => changeRole(person, true)} disabled={busyId !== null} className="tap-target inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
          <UserRoundPlus size={15} />{sw ? "Mpe uwezo wa msimamizi" : "Promote to Admin"}
        </button>}
      />
    </div>
  );
}

function RoleList({ title, people, loading, error, empty, renderAction, badge, lang }: {
  title: string;
  people: Profile[];
  loading: boolean;
  error: unknown;
  empty: string;
  renderAction: (person: Profile) => React.ReactNode;
  badge?: (person: Profile) => string | null;
  lang: "en" | "sw";
}) {
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const visible = people.slice(page * pageSize, (page + 1) * pageSize);
  return <section className="space-y-3 rounded-2xl border bg-card p-4">
    <h2 className="font-bold">{title}</h2>
    {loading ? <div className="space-y-3" aria-label="Loading"><div className="h-12 animate-pulse rounded-xl bg-muted" /><div className="h-12 animate-pulse rounded-xl bg-muted" /></div>
      : error ? <p role="alert" className="text-sm text-destructive">Could not load this list. {error instanceof Error ? error.message : ""}</p>
      : !people.length ? <p className="text-sm text-muted-foreground">{empty}</p>
      : <><ul className="divide-y">{visible.map((person) => <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} className="shrink-0 text-primary" />{person.full_name || "—"}{badge?.(person) && <span className="text-xs text-muted-foreground">{badge(person)}</span>}</div>
          <p className="text-xs text-muted-foreground">{person.business_name || "—"} · {person.phone || "—"}</p>
        </div>
        {renderAction(person)}
      </li>)}</ul>{people.length > pageSize && <div className="flex items-center justify-between pt-2 text-sm">
        <span className="text-muted-foreground">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, people.length)} / {people.length}</span>
        <div className="flex gap-2">
          <button onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">{lang === "sw" ? "Iliyotangulia" : "Previous"}</button>
          <button onClick={() => setPage((current) => current + 1)} disabled={(page + 1) * pageSize >= people.length} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">{lang === "sw" ? "Ifuatayo" : "Next"}</button>
        </div>
      </div>}</>}
  </section>;
}
