import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { QuickFilterBar, getPeriodRange, type PeriodKey } from "@/components/QuickFilterBar";
import { formatKsh } from "@/lib/format";
import { Download, FileText } from "lucide-react";
import jsPDF from "jspdf";

export const Route = createFileRoute("/app/reports")({ component: Reports });

function Reports() {
  const { t } = useI18n();
  const [period, setPeriod] = useState<PeriodKey>("thisMonth");
  const { from, to } = getPeriodRange(period);
  const periodLabel = t(period);

  const { data } = useQuery({
    queryKey: ["reports", period],
    queryFn: async () => {
      const [salesRes, expRes, prodRes] = await Promise.all([
        supabase.from("sales").select("date, product_name_snapshot, quantity, unit_price, total, is_credit").gte("date", from.toISOString()).lte("date", to.toISOString()).order("date"),
        supabase.from("expenses").select("date, category, amount, description").gte("date", from.toISOString()).lte("date", to.toISOString()).order("date"),
        supabase.from("products").select("name, current_stock, low_stock_threshold, cost_price, unit").eq("is_active", true),
      ]);
      const sales = salesRes.data ?? [];
      const expenses = expRes.data ?? [];
      const products = prodRes.data ?? [];
      const salesTotal = sales.reduce((s, r) => s + Number(r.total), 0);
      const expenseTotal = expenses.reduce((s, r) => s + Number(r.amount), 0);
      const stockValue = products.reduce((s, p) => s + Number(p.current_stock) * Number(p.cost_price), 0);
      const lowCount = products.filter((p) => Number(p.current_stock) <= Number(p.low_stock_threshold)).length;
      return { sales, expenses, products, salesTotal, expenseTotal, stockValue, lowCount, profit: salesTotal - expenseTotal };
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">{t("reports")}</h1>
      <QuickFilterBar value={period} onChange={setPeriod} />

      <Section
        title={t("salesSummary")}
        onCSV={() => downloadCSV("sales-summary", ["Date", "Product", "Quantity", "Unit price", "Total", "Credit"], (data?.sales ?? []).map((s: any) => [new Date(s.date).toLocaleDateString(), s.product_name_snapshot, s.quantity, s.unit_price, s.total, s.is_credit ? "yes" : "no"]))}
        onPDF={() => downloadPDF(`${t("salesSummary")} — ${periodLabel}`, [["Date", "Product", "Qty", "Unit", "Total"]], (data?.sales ?? []).map((s: any) => [new Date(s.date).toLocaleDateString(), s.product_name_snapshot, String(s.quantity), formatKsh(Number(s.unit_price)), formatKsh(Number(s.total))]), `${t("totalSales")}: ${formatKsh(data?.salesTotal ?? 0)}`)}
      >
        <BigLine label={t("totalSales")} value={formatKsh(data?.salesTotal ?? 0)} />
        <SmallLine label={`${t("sales")} count`} value={String((data?.sales ?? []).length)} />
      </Section>

      <Section
        title={t("expensesReport")}
        onCSV={() => downloadCSV("expenses", ["Date", "Category", "Description", "Amount"], (data?.expenses ?? []).map((r: any) => [new Date(r.date).toLocaleDateString(), r.category, r.description ?? "", r.amount]))}
        onPDF={() => downloadPDF(`${t("expensesReport")} — ${periodLabel}`, [["Date", "Category", "Description", "Amount"]], (data?.expenses ?? []).map((r: any) => [new Date(r.date).toLocaleDateString(), r.category, r.description ?? "", formatKsh(Number(r.amount))]), `${t("totalExpenses")}: ${formatKsh(data?.expenseTotal ?? 0)}`)}
      >
        <BigLine label={t("totalExpenses")} value={formatKsh(data?.expenseTotal ?? 0)} />
      </Section>

      <Section
        title={t("profitEstimate")}
        onCSV={() => downloadCSV("profit", ["Period", "Sales", "Expenses", "Profit"], [[periodLabel, data?.salesTotal ?? 0, data?.expenseTotal ?? 0, data?.profit ?? 0]])}
        onPDF={() => downloadPDF(`${t("profitEstimate")} — ${periodLabel}`, [["Metric", "Value"]], [[t("totalSales"), formatKsh(data?.salesTotal ?? 0)], [t("totalExpenses"), formatKsh(data?.expenseTotal ?? 0)], [t("profit"), formatKsh(data?.profit ?? 0)]])}
      >
        <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
          <div className="text-sm font-semibold opacity-90">{t("profitCaption")} {periodLabel}</div>
          <div className="mt-1 text-4xl font-extrabold">{formatKsh(data?.profit ?? 0)}</div>
        </div>
      </Section>

      <Section
        title={t("inventoryStatus")}
        onCSV={() => downloadCSV("inventory", ["Product", "Unit", "Stock", "Low threshold", "Cost price", "Stock value"], (data?.products ?? []).map((p: any) => [p.name, p.unit, p.current_stock, p.low_stock_threshold, p.cost_price, Number(p.current_stock) * Number(p.cost_price)]))}
        onPDF={() => downloadPDF(`${t("inventoryStatus")}`, [["Product", "Stock", "Low", "Value"]], (data?.products ?? []).map((p: any) => [p.name, `${p.current_stock} ${p.unit}`, String(p.low_stock_threshold), formatKsh(Number(p.current_stock) * Number(p.cost_price))]), `${t("stockValue")}: ${formatKsh(data?.stockValue ?? 0)}`)}
      >
        <BigLine label={t("totalProducts")} value={String((data?.products ?? []).length)} />
        <SmallLine label={t("lowStock")} value={String(data?.lowCount ?? 0)} />
        <SmallLine label={t("stockValue")} value={formatKsh(data?.stockValue ?? 0)} />
      </Section>
    </div>
  );
}

function Section({ title, children, onCSV, onPDF }: { title: string; children: React.ReactNode; onCSV: () => void; onPDF: () => void }) {
  const { t } = useI18n();
  return (
    <div className="card-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <div className="flex gap-2">
          <button onClick={onPDF} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"><FileText size={14} /> {t("exportPDF")}</button>
          <button onClick={onCSV} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"><Download size={14} /> {t("exportCSV")}</button>
        </div>
      </div>
      <div className="mt-3 grid gap-2">{children}</div>
    </div>
  );
}
function BigLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-baseline justify-between"><span className="text-sm text-muted-foreground">{label}</span><span className="text-2xl font-extrabold">{value}</span></div>;
}
function SmallLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-baseline justify-between"><span className="text-sm text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>;
}

function downloadCSV(name: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `vendorhub-${name}-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function downloadPDF(title: string, header: string[][], rows: string[][], footer?: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("VendorHub", 40, 40);
  doc.setFontSize(13); doc.text(title, 40, 62);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  let y = 90;
  const cols = header[0];
  const colW = (595 - 80) / cols.length;
  doc.setFont("helvetica", "bold");
  cols.forEach((h, i) => doc.text(h, 40 + i * colW, y));
  doc.setFont("helvetica", "normal");
  y += 16;
  for (const r of rows) {
    if (y > 780) { doc.addPage(); y = 40; }
    r.forEach((c, i) => doc.text(String(c ?? "").substring(0, 30), 40 + i * colW, y));
    y += 14;
  }
  if (footer) { y += 10; doc.setFont("helvetica", "bold"); doc.text(footer, 40, y); }
  doc.save(`vendorhub-${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}
