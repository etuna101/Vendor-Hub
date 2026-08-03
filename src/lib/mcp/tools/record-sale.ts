import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "record_sale",
  title: "Record a sale",
  description:
    "Record a sale for the signed-in vendor. Checks stock, decrements inventory and logs the sale atomically.",
  inputSchema: {
    product_id: z.string().uuid().describe("Product id from list_products."),
    quantity: z.number().positive().describe("Quantity sold in the product's unit."),
    unit_price: z.number().positive().optional().describe("Price per unit in KES. Defaults to the product's selling price."),
    is_credit: z.boolean().optional().describe("True when the customer is buying on credit (deni)."),
    customer_id: z.string().uuid().optional().describe("Customer id, required for credit sales."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ product_id, quantity, unit_price, is_credit, customer_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, unit, current_stock, selling_price")
      .eq("id", product_id)
      .maybeSingle();
    if (productError) return { content: [{ type: "text", text: productError.message }], isError: true };
    if (!product) return { content: [{ type: "text", text: "Product not found" }], isError: true };

    const price = unit_price ?? Number(product.selling_price);
    if (is_credit && !customer_id) {
      return { content: [{ type: "text", text: "customer_id is required for credit sales" }], isError: true };
    }

    const { data, error } = await supabase.rpc("record_sale", {
      _product_id: product_id,
      _quantity: quantity,
      _unit_price: price,
      _is_credit: Boolean(is_credit),
      _customer_id: customer_id ?? (null as unknown as string),
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const result = {
      sale_id: data,
      product: product.name,
      quantity,
      unit: product.unit,
      unit_price: price,
      total: Math.round(price * quantity * 100) / 100,
      is_credit: Boolean(is_credit),
    };
    return {
      content: [{ type: "text", text: `Recorded sale: ${quantity} ${product.unit} of ${product.name} for KES ${result.total}.` }],
      structuredContent: result,
    };
  },
});
