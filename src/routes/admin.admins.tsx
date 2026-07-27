import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, X } from "lucide-react";

export const Route = createFileRoute("/admin/admins")({ component: AdminsPage });

type Profile = { id: string; full_name: string; business_name: string; phone: string };

function AdminsPage() {
  const [admins, setAdmins] = useState<Profile[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: userData } = await supabase.auth.getUser();
    setMe(userData.user?.id ?? null);
    const { data: roles, error } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (error) { toast.error(error.message); return; }
    const ids = (roles ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) { setAdmins([]); return; }
    const { data: profs } = await supabase.from("profiles").select("id, full_name, business_name, phone").in("id", ids);
    setAdmins((profs ?? []) as any);
  };

  useEffect(() => { load(); }, []);

  const search = async () => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    const clean = q.replace(/[^0-9+a-zA-Z ]/g, "");
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, business_name, phone")
      .or(`phone.ilike.%${clean}%,full_name.ilike.%${clean}%,business_name.ilike.%${clean}%`)
      .limit(10);
    setResults((data ?? []) as any);
  };

  const promote = async (userId: string) => {
    setBusy(true);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Promoted to admin");
    setQuery(""); setResults([]);
    load();
  };

  const revoke = async (userId: string) => {
    if (userId === me) return toast.error("You cannot revoke your own admin role.");
    if (!confirm("Revoke admin access for this account?")) return;
    setBusy(true);
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Admin access revoked");
    load();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold">Manage Admins</h1>
        <p className="text-muted-foreground text-sm">Only existing admins can grant or revoke admin access.</p>
      </div>

      <div className="rounded-2xl bg-card border p-4 space-y-3">
        <div className="font-bold">Current admins</div>
        {admins === null ? <p className="text-muted-foreground text-sm">Loading…</p>
          : admins.length === 0 ? <p className="text-muted-foreground text-sm">No admins yet.</p>
          : (
          <ul className="divide-y">
            {admins.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-semibold flex items-center gap-2"><ShieldCheck size={16} className="text-primary" /> {a.full_name || "—"} {a.id === me && <span className="text-xs text-muted-foreground">(you)</span>}</div>
                  <div className="text-xs text-muted-foreground">{a.business_name} · {a.phone}</div>
                </div>
                <button
                  onClick={() => revoke(a.id)} disabled={busy || a.id === me}
                  className="rounded-xl border px-3 py-1.5 text-sm font-semibold text-destructive disabled:opacity-40 hover:bg-destructive/10 flex items-center gap-1"
                >
                  <X size={14} /> Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl bg-card border p-4 space-y-3">
        <div className="font-bold">Promote a vendor to admin</div>
        <div className="flex gap-2">
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") search(); }}
            placeholder="Search by phone, name, or business"
            className="flex-1 rounded-xl border bg-background px-4 py-2 text-sm"
          />
          <button onClick={search} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">Search</button>
        </div>
        {results.length > 0 && (
          <ul className="divide-y">
            {results.map((r) => {
              const isAdmin = admins?.some((a) => a.id === r.id);
              return (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-semibold">{r.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.business_name} · {r.phone}</div>
                  </div>
                  <button
                    onClick={() => promote(r.id)} disabled={busy || isAdmin}
                    className="rounded-xl bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
                  >
                    {isAdmin ? "Already admin" : "Promote"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
