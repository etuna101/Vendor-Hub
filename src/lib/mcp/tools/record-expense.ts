import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const CATEGORIES = ["transport", "rent", "wages", "market_fee", "misc", "stock_purchase", "utilities", "other"] as const;

export default defineTool({
  name: "record_expense",
  title: "Record an expense",
  description: "Record a business expense for the signed-in vendor.",
  inputSchema: {
    amount: z.number().positive().describe("Expense amount in KES."),
    category: z.enum(CATEGORIES).describe("Expense category."),
    note: z.string().trim().max(200).optional().describe("Optional short note."),
    date: z.string().optional().describe("ISO date (YYYY-MM-DD). Defaults to today."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ amount, category, note, date }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: ctx.getUserId()!,
        amount,
        category,
        description: note ?? null,
        date: date ?? new Date().toISOString().slice(0, 10),
      })
      .select()
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Recorded ${category} expense of KES ${amount}.` }],
      structuredContent: { expense: data },
    };
  },
});
