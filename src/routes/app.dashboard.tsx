import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { QuickFilterBar, getPeriodRange, type PeriodKey } from "@/components/QuickFilterBar";
import { formatKsh } from "@/lib/format";
import { getDashboardInsight } from "@/lib/ai.functions";
import { AlertTriangle, Coins, HandCoins, ShoppingCart, Wallet, Receipt, BarChart3, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/dashboard")({ component: Dashboard });

function Dashboard() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>("today");
  const { from, to } = getPeriodRange(period);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, business_name").maybeSingle();
      return data;
    },
  });

  const { data } = useQuery({
    queryKey: ["dashboard", period],
    queryFn: async () => {
      const [salesRes, expensesRes, productsRes, creditRes] = await Promise.all([
        supabase.from("sales").select("total, date").gte("date", from.toISOString()).lte("date", to.toISOString()),
        supabase.from("expenses").select("amount").gte("date", from.toISOString()).lte("date", to.toISOString()),
        supabase.from("products").select("current_stock, low_stock_threshold").eq("is_active", true),
        supabase.from("sales").select("total, customer_id").eq("is_credit", true).eq("credit_paid", false),
      ]);
      const salesRows = salesRes.data ?? [];
      const sales = salesRows.reduce((s, r) => s + Number(r.total), 0);
      const expenses = (expensesRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const lowStock = (productsRes.data ?? []).filter((p) => Number(p.current_stock) <= Number(p.low_stock_threshold)).length;
      const owed = (creditRes.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const customersOwing = new Set((creditRes.data ?? []).filter((r) => r.customer_id).map((r) => r.customer_id)).size;
      return { sales, expenses, profit: sales - expenses, lowStock, owed, customersOwing, salesRows };
    },
  });

  const trend = useMemo(() => buildTrend(data?.salesRows ?? [], from, to), [data?.salesRows, from, to]);

  const insight = useServerFn(getDashboardInsight);
  const { data: insightData, isLoading: insightLoading } = useQuery({
    queryKey: ["dashboard-insight", lang, period, data?.sales, data?.expenses, data?.lowStock, data?.owed],
    queryFn: () => insight({ data: { language: lang } }),
    enabled: !!data,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const greet = lang === "en" ? "Karibu" : "Karibu";
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted-foreground">{greet},</p>
        <h1 className="text-2xl font-extrabold">{profile?.business_name || profile?.full_name || t("dashboard")}</h1>
      </div>
      <QuickFilterBar value={period} onChange={setPeriod} />

      <SyncReviewCard />

      <InsightCard loading={insightLoading} text={insightData?.insight} lang={lang} />


      <div className="grid grid-cols-2 gap-3">
        <Stat onClick={() => nav({ to: "/app/sales" })} icon={<ShoppingCart size={18} />} label={t("totalSales")} value={formatKsh(data?.sales ?? 0)} tone="primary" />
        <Stat onClick={() => nav({ to: "/app/expenses" })} icon={<Receipt size={18} />} label={t("totalExpenses")} value={formatKsh(data?.expenses ?? 0)} tone="muted" />
        <Stat onClick={() => nav({ to: "/app/reports" })} icon={<Coins size={18} />} label={`${t("profit")} — ${t(period)}`} value={formatKsh(data?.profit ?? 0)} tone={data && data.profit >= 0 ? "primary" : "danger"} big />
        <Stat onClick={() => nav({ to: "/app/inventory", search: { low: 1 } })} icon={<AlertTriangle size={18} />} label={t("lowStock")} value={String(data?.lowStock ?? 0)} tone={data && data.lowStock > 0 ? "warning" : "muted"} />
        <Stat onClick={() => nav({ to: "/app/credit" })} icon={<HandCoins size={18} />} label={t("outstandingCredit")} value={formatKsh(data?.owed ?? 0)} tone={data && data.owed > 0 ? "danger" : "muted"} />
        <Stat onClick={() => nav({ to: "/app/credit" })} icon={<Users size={18} />} label={t("customersOwing")} value={String(data?.customersOwing ?? 0)} tone="muted" />
      </div>

      <TrendCard points={trend} label={`${t("totalSales")} — ${t(period)}`} lang={lang} />

      <div className="grid grid-cols-2 gap-3">
        <Link to="/app/reports" className="card-soft tap-target flex items-center justify-center gap-2 font-semibold text-primary">
          <BarChart3 size={18} /> {t("reports")}
        </Link>
        <Link to="/app/expenses" className="card-soft tap-target flex items-center justify-center gap-2 font-semibold text-primary">
          <Wallet size={18} /> {t("expenses")}
        </Link>
      </div>
    </div>
  );
}

function InsightCard({ loading, text, lang }: { loading: boolean; text?: string; lang: "en" | "sw" }) {
  return (
    <div className="card-soft flex gap-3 border-primary/20 bg-primary/5 p-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15">
        <Sparkles size={18} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold uppercase tracking-wide text-primary">{lang === "sw" ? "Ushauri wa leo" : "Today's insight"}</div>
        {loading ? (
          <div className="mt-1 h-4 w-3/4 animate-pulse rounded bg-primary/10" />
        ) : (
          <p className="mt-0.5 text-[15px] leading-relaxed text-foreground">
            {text || (lang === "sw" ? "Andika mauzo na matumizi zaidi ili msaidizi akupe ushauri bora." : "Record more sales and expenses so the assistant can give sharper advice.")}
          </p>
        )}
      </div>
    </div>
  );
}

function buildTrend(rows: { total: number | string; date: string }[], from: Date, to: Date) {
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const useHours = days <= 1;
  const buckets = useHours ? 24 : Math.min(days, 30);
  const arr = new Array(buckets).fill(0) as number[];
  const span = to.getTime() - from.getTime();
  for (const r of rows) {
    const t = new Date(r.date).getTime();
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((t - from.getTime()) / (span || 1)) * buckets)));
    arr[idx] += Number(r.total);
  }
  return arr;
}

function TrendCard({ points, label, lang }: { points: number[]; label: string; lang: "en" | "sw" }) {
  const max = Math.max(...points, 1);
  const total = points.reduce((s, v) => s + v, 0);
  const w = 320;
  const h = 80;
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const d = points
    .map((v, i) => {
      const x = i * step;
      const y = h - (v / max) * (h - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${d} L${((points.length - 1) * step).toFixed(1)},${h} L0,${h} Z`;
  return (
    <div className="card-soft p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-muted-foreground">{label}</div>
        <div className="text-sm font-bold text-primary">{formatKsh(total)}</div>
      </div>
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{lang === "sw" ? "Hakuna mauzo katika kipindi hiki bado." : "No sales in this period yet."}</p>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-24 w-full text-primary">
          <path d={area} fill="currentColor" opacity={0.12} />
          <path d={d} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function Stat({ icon, label, value, tone, big, onClick }: { icon: React.ReactNode; label: string; value: string; tone: "primary" | "warning" | "danger" | "muted"; big?: boolean; onClick?: () => void }) {
  const toneCls = {
    primary: "bg-primary text-primary-foreground",
    warning: "bg-warning text-warning-foreground",
    danger: "bg-danger text-danger-foreground",
    muted: "bg-card text-foreground",
  }[tone];
  return (
    <button onClick={onClick} className={`card-soft flex flex-col items-start gap-1 p-4 text-left ${big ? "col-span-2" : ""} ${tone !== "muted" ? toneCls + " border-transparent" : ""}`}>
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${tone === "muted" ? "text-muted-foreground" : "opacity-90"}`}>
        {icon} <span>{label}</span>
      </div>
      <div className={`font-extrabold ${big ? "text-3xl" : "text-xl"}`}>{value}</div>
    </button>
  );
}
