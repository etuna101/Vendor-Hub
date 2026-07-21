import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type Lang = "en" | "sw";

async function buildVendorContext(supabase: any, userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const start30 = new Date(now.getTime() - 30 * 864e5).toISOString();

  const [salesMonth, expensesMonth, products, credit, topSales] = await Promise.all([
    supabase.from("sales").select("total, product_name_snapshot, quantity, date").gte("date", startOfMonth),
    supabase.from("expenses").select("amount, category").gte("date", startOfMonth),
    supabase.from("products").select("name, current_stock, low_stock_threshold, selling_price").eq("is_active", true),
    supabase.from("sales").select("total, customer_id, customers(name)").eq("is_credit", true).eq("credit_paid", false),
    supabase.from("sales").select("product_name_snapshot, total").gte("date", start30),
  ]);

  const salesTotal = (salesMonth.data ?? []).reduce((s: number, r: any) => s + Number(r.total), 0);
  const expTotal = (expensesMonth.data ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
  const low = (products.data ?? []).filter((p: any) => Number(p.current_stock) <= Number(p.low_stock_threshold));
  const owed = (credit.data ?? []).reduce((s: number, r: any) => s + Number(r.total), 0);
  const owingCustomers = new Set((credit.data ?? []).map((r: any) => r.customer_id).filter(Boolean)).size;

  const productTotals: Record<string, number> = {};
  for (const r of topSales.data ?? []) {
    productTotals[r.product_name_snapshot] = (productTotals[r.product_name_snapshot] || 0) + Number(r.total);
  }
  const bestSeller = Object.entries(productTotals).sort((a, b) => b[1] - a[1])[0];

  return {
    salesTotal,
    expensesTotal: expTotal,
    profit: salesTotal - expTotal,
    lowStockCount: low.length,
    lowStockItems: low.slice(0, 5).map((p: any) => p.name),
    productCount: (products.data ?? []).length,
    outstandingCredit: owed,
    customersOwing: owingCustomers,
    bestSeller: bestSeller ? { name: bestSeller[0], revenue: bestSeller[1] } : null,
  };
}

function contextToSummary(c: Awaited<ReturnType<typeof buildVendorContext>>) {
  return [
    `Sales this month: KES ${Math.round(c.salesTotal).toLocaleString()}.`,
    `Expenses this month: KES ${Math.round(c.expensesTotal).toLocaleString()}.`,
    `Estimated profit this month: KES ${Math.round(c.profit).toLocaleString()}.`,
    `Active products: ${c.productCount}. Low-stock items: ${c.lowStockCount}${c.lowStockItems.length ? ` (${c.lowStockItems.join(", ")})` : ""}.`,
    `Outstanding customer credit (deni): KES ${Math.round(c.outstandingCredit).toLocaleString()} across ${c.customersOwing} customer(s).`,
    c.bestSeller ? `Best-selling product last 30 days: ${c.bestSeller.name} (KES ${Math.round(c.bestSeller.revenue).toLocaleString()}).` : `No sales in the last 30 days.`,
  ].join(" ");
}

function systemPrompt(lang: Lang, mode: "insight" | "chat") {
  const langLine = lang === "sw"
    ? "Respond only in simple Kiswahili that a Mama Mboga vendor can easily read."
    : "Respond only in simple English that a Mama Mboga vendor can easily read.";
  const shape = mode === "insight"
    ? "Give exactly ONE short, friendly sentence of business advice — no lists, no preamble."
    : "Keep responses to 2-4 short sentences in plain language. Use bullet points only if truly necessary.";
  return [
    "You are VendorHub's business advisor for small fresh-produce vendors ('Mama Mboga') in Kenya.",
    "Base every answer strictly on the vendor data summary provided. NEVER invent numbers, product names, or customers that are not in the data.",
    "If the data does not answer the question, say so honestly and suggest what to record next.",
    "Use KES for money. Be warm and encouraging.",
    langLine,
    shape,
  ].join(" ");
}

async function callGateway(messages: any[]) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 402) throw new Error("CREDITS");
  if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

export const getDashboardInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { language?: Lang }) => ({ language: d?.language === "sw" ? "sw" : "en" as Lang }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const ctx = await buildVendorContext(supabase, userId);
    const summary = contextToSummary(ctx);
    const content = await callGateway([
      { role: "system", content: systemPrompt(data.language, "insight") },
      { role: "user", content: `Vendor data summary:\n${summary}\n\nGive one short insight or recommendation for today.` },
    ]);
    await supabase.from("ai_interactions").insert({ user_id: userId, kind: "insight", query: "dashboard_insight", response: content, language: data.language });
    return { insight: content };
  });

export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { question: string; language?: Lang }) => {
    const q = String(d?.question ?? "").trim();
    if (!q) throw new Error("Empty question");
    if (q.length > 500) throw new Error("Question too long");
    return { question: q, language: d?.language === "sw" ? "sw" : "en" as Lang };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const ctx = await buildVendorContext(supabase, userId);
    const summary = contextToSummary(ctx);
    const content = await callGateway([
      { role: "system", content: systemPrompt(data.language, "chat") },
      { role: "user", content: `Vendor data summary:\n${summary}\n\nVendor question: ${data.question}` },
    ]);
    await supabase.from("ai_interactions").insert({ user_id: userId, kind: "chat", query: data.question, response: content, language: data.language });
    return { answer: content };
  });

export const getChatHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data } = await supabase.from("ai_interactions").select("id, kind, query, response, language, created_at").eq("kind", "chat").order("created_at", { ascending: true }).limit(50);
    return { messages: data ?? [] };
  });
