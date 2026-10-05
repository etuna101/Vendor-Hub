import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, ShoppingCart, HandCoins, Sparkles, CircleUserRound } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function BottomNav() {
  const { t, lang } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/app/dashboard", label: t("dashboard"), Icon: LayoutDashboard },
    { to: "/app/inventory", label: t("inventory"), Icon: Package },
    { to: "/app/sales", label: t("sales"), Icon: ShoppingCart },
    { to: "/app/credit", label: t("credit"), Icon: HandCoins },
    { to: "/app/assistant", label: t("assistant"), Icon: Sparkles },
    { to: "/app/profile", label: lang === "sw" ? "Wasifu" : "Profile", Icon: CircleUserRound },
  ];
  return (
    <nav className="sticky bottom-0 z-30 border-t border-border bg-card/98 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid max-w-2xl grid-cols-6">
        {tabs.map(({ to, label, Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              preload="intent"
              className={`flex min-h-[64px] flex-col items-center justify-center gap-1 py-2 text-xs font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
