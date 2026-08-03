import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_products",
  title: "List products",
  description: "List the signed-in vendor's active products with stock levels and prices.",
  inputSchema: {
    low_stock_only: z
      .boolean()
      .optional()
      .describe("When true, only return products at or below their low-stock threshold."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ low_stock_only }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("products")
      .select("id, name, unit, current_stock, low_stock_threshold, cost_price, selling_price")
      .eq("is_active", true)
      .order("name");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []).filter((p) =>
      low_stock_only ? Number(p.current_stock) <= Number(p.low_stock_threshold) : true,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { products: rows },
    };
  },
});
