import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProducts from "./tools/list-products";
import businessSummary from "./tools/business-summary";
import outstandingCredit from "./tools/outstanding-credit";
import recordSale from "./tools/record-sale";
import recordExpense from "./tools/record-expense";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "mama-mboga-s-helper",
  title: "Mama Mboga's Helper",
  version: "0.1.0",
  instructions:
    "Tools for a VendorHub vendor's own business records (Kenyan fresh-produce stall). Use business_summary for sales, expenses and profit; list_products for stock levels (low_stock_only for restocking); outstanding_credit for unpaid customer debt (deni); record_sale and record_expense to write new records. All money is KES and all data is scoped to the signed-in vendor.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [businessSummary, listProducts, outstandingCredit, recordSale, recordExpense],
});
