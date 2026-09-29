import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LogOut } from "lucide-react";
import { DueDebtNotifications } from "@/components/DueDebtNotifications";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth/signin" });
  },
  component: AppShell,
});

function AppShell() {
  const { signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      await navigate({ to: "/auth/signin", replace: true });
    } catch {
      setSigningOut(false);
      toast.error(t("signOut"));
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <DueDebtNotifications />
      <TopBar
        right={
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label={t("signOut")}
            aria-busy={signingOut}
            className="flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold text-muted-foreground disabled:opacity-60"
          >
            <LogOut size={16} />{" "}
            <span className="hidden sm:inline">{signingOut ? "…" : t("signOut")}</span>
          </button>
        }
      />
      <main className="flex-1 px-4 pt-4 pb-6">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
