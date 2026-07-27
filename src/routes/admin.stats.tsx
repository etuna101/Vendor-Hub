import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, ShoppingBag, Package, AlertTriangle, MessageSquare, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/stats")({ component: StatsPage });

type Stats = {
  total_vendors: number;
  total_admins: number;
  total_sales: number;
  total_sales_amount: number;
  total_products: number;
  low_stock_alerts: number;
  total_ai_interactions: number;
  expense_categories: { category: string; count: number; total: number }[];
};

function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("admin_platform_stats" as any);
      if (error) setErr(error.message);
      else setStats(data as any);
    })();
  }, []);

  if (err) return <p className="text-destructive">{err}</p>;
  if (!stats) return <p className="text-muted-foreground">Loading platform stats…</p>;

  const cards = [
    { label: "Total Vendors", value: stats.total_vendors, icon: Users },
    { label: "Total Admins", value: stats.total_admins, icon: ShieldCheck },
    { label: "Total Sales", value: stats.total_sales, icon: ShoppingBag },
    { label: "Sales Volume (KES)", value: `KES ${Math.round(Number(stats.total_sales_amount)).toLocaleString()}`, icon: ShoppingBag },
    { label: "Total Products", value: stats.total_products, icon: Package },
    { label: "Low-Stock Alerts", value: stats.low_stock_alerts, icon: AlertTriangle },
    { label: "AI Interactions", value: stats.total_ai_interactions, icon: MessageSquare },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold">Platform Stats</h1>
        <p className="text-muted-foreground text-sm">Aggregated usage across all vendors.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl bg-card border p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                <Icon size={14} /> {c.label}
              </div>
              <div className="mt-2 text-2xl font-extrabold">{c.value}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl bg-card border p-4">
        <h2 className="font-bold mb-3">Most Common Expense Categories</h2>
        {stats.expense_categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase border-b">
                <th className="py-2">Category</th>
                <th className="py-2">Count</th>
                <th className="py-2 text-right">Total (KES)</th>
              </tr>
            </thead>
            <tbody>
              {stats.expense_categories.map((e) => (
                <tr key={e.category} className="border-b last:border-0">
                  <td className="py-2 capitalize">{e.category.replace(/_/g, " ")}</td>
                  <td className="py-2">{e.count}</td>
                  <td className="py-2 text-right">{Math.round(Number(e.total)).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
