import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LogOut, LayoutDashboard, Users, MessageSquare, FileText, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth/signin" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/app/dashboard" });
  },
  component: AdminShell,
});

const NAV = [
  { to: "/admin/stats", label: "Platform Stats", icon: LayoutDashboard },
  { to: "/admin/vendors", label: "Vendors", icon: Users },
  { to: "/admin/ai-log", label: "AI Interactions", icon: MessageSquare },
  { to: "/admin/prompts", label: "System Prompts", icon: FileText },
  { to: "/admin/admins", label: "Manage Admins", icon: ShieldCheck },
] as const;

function AdminShell() {
  const { signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden md:flex w-64 flex-col border-r bg-card">
        <div className="flex h-16 items-center gap-2 border-b px-5 font-extrabold text-primary">
          <ShieldCheck size={22} /> VendorHub Admin
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
                <Icon size={18} /> {n.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={signOut} className="m-3 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-muted">
          <LogOut size={16} /> Sign out
        </button>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between border-b bg-card px-4 h-14">
          <div className="font-extrabold text-primary flex items-center gap-2"><ShieldCheck size={18} /> Admin</div>
          <button onClick={signOut} className="text-sm font-semibold text-muted-foreground flex items-center gap-1"><LogOut size={14} />Sign out</button>
        </header>
        <div className="md:hidden overflow-x-auto border-b bg-card">
          <div className="flex gap-1 px-2 py-2">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.to);
              return (
                <Link key={n.to} to={n.to}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {n.label}
                </Link>
              );
            })}
          </div>
        </div>
        <main className="flex-1 p-4 md:p-8 overflow-x-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
