import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, ShoppingBag, Package, AlertTriangle, MessageSquare, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/stats")({ component: StatsPage });

type Stats = {
  total_vendors: number; total_admins: number; total_sales: number; total_sales_amount: number;
  total_products: number; low_stock_alerts: number; total_ai_interactions: number;
  expense_categories: { category: string; count: number; total: number }[];
};

function StatsPage() {
  const { data: stats, error, isLoading } = useQuery({
    queryKey: ["admin-platform-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_platform_stats" as any);
      if (error) throw error;
      return data as Stats;
    },
  });
  if (error) return <p role="alert" className="text-destructive">{error.message}</p>;
  if (isLoading || !stats) return <div className="space-y-4" aria-label="Loading"><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-primary/10" />)}</div><div className="h-48 animate-pulse rounded-2xl bg-primary/10" /></div>;

  const cards = [
    { label: "Total Vendors", value: stats.total_vendors, icon: Users },
    { label: "Total Admins", value: stats.total_admins, icon: ShieldCheck },
    { label: "Total Sales", value: stats.total_sales, icon: ShoppingBag },
    { label: "Sales Volume (KES)", value: `KES ${Math.round(Number(stats.total_sales_amount)).toLocaleString()}`, icon: ShoppingBag },
    { label: "Total Products", value: stats.total_products, icon: Package },
    { label: "Low-Stock Alerts", value: stats.low_stock_alerts, icon: AlertTriangle },
    { label: "AI Interactions", value: stats.total_ai_interactions, icon: MessageSquare },
  ];
  return <div className="max-w-6xl space-y-6">
    <header><h1 className="text-2xl font-extrabold md:text-3xl">Platform Stats</h1><p className="text-sm text-muted-foreground">Aggregated usage across all vendors.</p></header>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Icon size={14} />{label}</div><div className="mt-2 text-2xl font-extrabold">{value}</div></div>)}</div>
    <section className="rounded-2xl border bg-card p-4"><h2 className="mb-3 font-bold">Most Common Expense Categories</h2>{stats.expense_categories.length === 0 ? <p className="text-sm text-muted-foreground">No expenses recorded yet.</p> : <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="py-2">Category</th><th className="py-2">Count</th><th className="py-2 text-right">Total (KES)</th></tr></thead><tbody>{stats.expense_categories.map((entry) => <tr key={entry.category} className="border-b last:border-0"><td className="py-2 capitalize">{entry.category.replace(/_/g, " ")}</td><td className="py-2">{entry.count}</td><td className="py-2 text-right">{Math.round(Number(entry.total)).toLocaleString()}</td></tr>)}</tbody></table>}</section>
  </div>;
}
