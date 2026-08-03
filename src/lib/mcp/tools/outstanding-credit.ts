import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "outstanding_credit",
  title: "Outstanding credit",
  description: "List unpaid customer credit ('deni') for the signed-in vendor, including overdue balances.",
  inputSchema: {
    overdue_only: z.boolean().optional().describe("When true, only return credit past its due date."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ overdue_only }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("sales")
      .select("id, total, date, due_date, credit_paid, product_name_snapshot, customers(name, phone)")
      .eq("is_credit", true)
      .eq("credit_paid", false)
      .order("date", { ascending: true });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const today = new Date().toISOString().slice(0, 10);
    const rows = (data ?? [])
      .map((r) => {
        const customer = (r as { customers?: { name?: string; phone?: string } | null }).customers;
        return {
          sale_id: r.id,
          customer: customer?.name ?? "Unknown",
          phone: customer?.phone ?? null,
          item: r.product_name_snapshot,
          amount: Number(r.total),
          date: r.date,
          due_date: r.due_date,
          overdue: Boolean(r.due_date && String(r.due_date).slice(0, 10) < today),
        };
      })
      .filter((r) => (overdue_only ? r.overdue : true));

    const result = {
      currency: "KES",
      total_outstanding: Math.round(rows.reduce((s, r) => s + r.amount, 0)),
      count: rows.length,
      credits: rows,
    };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
  },
});
