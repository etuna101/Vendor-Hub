import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "business_summary",
  title: "Business summary",
  description:
    "Summarise the signed-in vendor's sales, expenses, estimated profit and low-stock count over a recent period.",
  inputSchema: {
    days: z.number().int().min(1).max(365).optional().describe("Number of past days to summarise (default 30)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const window = days ?? 30;
    const since = new Date(Date.now() - window * 864e5).toISOString();

    const [sales, expenses, products] = await Promise.all([
      supabase.from("sales").select("total, product_name_snapshot").gte("date", since),
      supabase.from("expenses").select("amount, category").gte("date", since),
      supabase.from("products").select("name, current_stock, low_stock_threshold").eq("is_active", true),
    ]);
    const firstError = sales.error ?? expenses.error ?? products.error;
    if (firstError) return { content: [{ type: "text", text: firstError.message }], isError: true };

    const salesTotal = (sales.data ?? []).reduce((s, r) => s + Number(r.total), 0);
    const expensesTotal = (expenses.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const byProduct: Record<string, number> = {};
    for (const r of sales.data ?? []) {
      byProduct[r.product_name_snapshot] = (byProduct[r.product_name_snapshot] ?? 0) + Number(r.total);
    }
    const topProducts = Object.entries(byProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, revenue]) => ({ name, revenue }));
    const lowStock = (products.data ?? [])
      .filter((p) => Number(p.current_stock) <= Number(p.low_stock_threshold))
      .map((p) => p.name);

    const summary = {
      period_days: window,
      currency: "KES",
      sales_total: Math.round(salesTotal),
      expenses_total: Math.round(expensesTotal),
      estimated_profit: Math.round(salesTotal - expensesTotal),
      sales_count: (sales.data ?? []).length,
      top_products: topProducts,
      low_stock_items: lowStock,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
