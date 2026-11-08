import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/account-status")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth/signin" });
    if (!data.user.email_confirmed_at) throw redirect({ to: "/auth/check-email" });
  },
  component: AccountStatus,
});
function AccountStatus() {
  const { lang } = useI18n();
  const sw = lang === "sw";
  const { data, isLoading, error } = useProfile();
  if (isLoading) return <main className="p-8 text-center">{sw ? "Inapakia akaunti yako…" : "Loading your account…"}</main>;
  if (error || !data) return <main className="p-8 text-center">{sw ? "Akaunti haikupakiwa. Jaribu tena." : "Could not load your account. Please try again."}</main>;
  const copy = {
    pending: sw ? ["Inasubiri idhini ya msimamizi", "Barua pepe yako imethibitishwa. Tutakujulisha akaunti yako ikiidhinishwa."] : ["Waiting for admin approval", "Your email is verified. We will let you know when your account is approved."],
    rejected: sw ? ["Akaunti haijaidhinishwa", data.rejection_reason || "Wasiliana na usaidizi wa VendorHub."] : ["Account not approved", data.rejection_reason || "Contact VendorHub support if you need help."],
    suspended: sw ? ["Akaunti imesimamishwa", "Wasiliana na usaidizi wa VendorHub."] : ["Account suspended", "Please contact VendorHub support for help."],
    approved: sw ? ["Akaunti yako iko tayari", "Sasa unaweza kutumia VendorHub."] : ["Your account is ready", "You can now use VendorHub."],
  } as const;
  const [heading, message] = copy[data.approval_status];
  return <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
    <h1 className="text-3xl font-extrabold">{heading}</h1><p className="text-muted-foreground">{message}</p>
    {data.approval_status === "approved" && <Link to="/app/dashboard" className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">{sw ? "Fungua VendorHub" : "Open VendorHub"}</Link>}
    <Link to="/app/profile" className="text-primary">{sw ? "Tazama wasifu wangu" : "View my profile"}</Link>
  </main>;
}
