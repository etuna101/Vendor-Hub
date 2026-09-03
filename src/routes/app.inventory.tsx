import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { offlineList, recordRestockOfflineFirst, recordStockLossOfflineFirst } from "@/lib/offline/actions";
import { useOffline } from "@/lib/offline/OfflineProvider";
import { useI18n } from "@/lib/i18n";
import { formatKsh, formatQty } from "@/lib/format";
import { buildStockAdvice, LOSS_LABELS, LOSS_REASONS, type LossReason, type StockAdvice } from "@/lib/stock-insights";
import { toast } from "sonner";
import { Plus, Package, AlertTriangle, PackagePlus, Trash2, Sparkles, TrendingDown } from "lucide-react";



const search = z.object({ low: z.coerce.number().optional() });

export const Route = createFileRoute("/app/inventory")({
  validateSearch: (s) => search.parse(s),
  component: Inventory,
});

function Inventory() {
  const { t, lang } = useI18n();
  const { low } = useSearch({ from: "/app/inventory" });
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [restocking, setRestocking] = useState<string | null>(null);
  const [losing, setLosing] = useState<string | null>(null);
  const [prefillQty, setPrefillQty] = useState<number>(1);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () =>
      offlineList<any>("products", async () => {
        const { data, error } = await supabase.from("products").select("*").eq("is_active", true).order("name");
        if (error) throw error;
        return data ?? [];
      }, (p) => p.is_active !== false),
  });

  // Last 14 days of sales power the restock advisor (sales velocity, days of stock left).
  const since = useMemo(() => new Date(Date.now() - 14 * 864e5), []);
  const { data: recentSales = [] } = useQuery({
    queryKey: ["sales-14d"],
    queryFn: () =>
      offlineList<any>("sales", async () => {
        const { data, error } = await supabase.from("sales").select("product_id, quantity, total, date").gte("date", since.toISOString());
        if (error) throw error;
        return data ?? [];
      }, (r) => new Date(r.date).getTime() >= since.getTime()),
  });

  const advice = useMemo(() => buildStockAdvice(products as any, recentSales as any), [products, recentSales]);
  const adviceById = useMemo(() => Object.fromEntries(advice.map((a) => [a.id, a])), [advice]);
  const restockList = advice.filter((a) => a.suggestedQty > 0 || a.status === "out");

  const openRestock = (id: string, qty: number) => { setPrefillQty(qty > 0 ? qty : 1); setRestocking(id); };

  const filtered = low ? products.filter((p) => Number(p.current_stock) <= Number(p.low_stock_threshold)) : products;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t("inventory")}</h1>
        <button onClick={() => setShowAdd(true)} className="tap-target inline-flex items-center gap-2 rounded-2xl bg-primary px-4 font-bold text-primary-foreground">
          <Plus size={18} /> {t("addProduct")}
        </button>
      </div>

      {low ? (
        <div className="card-soft flex items-center gap-2 bg-warning p-3 text-warning-foreground">
          <AlertTriangle size={18} /> <span className="font-semibold">{lang === "en" ? "Showing low-stock items only" : "Zinaonyeshwa zinazoisha tu"}</span>
        </div>
      ) : null}

      {restockList.length > 0 && (
        <div className="card-soft border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <h2 className="text-base font-extrabold text-primary">{lang === "sw" ? "Mpango wa kuongeza stoo" : "Restock plan"}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {lang === "sw"
              ? "Kutoka mauzo yako ya siku 14 zilizopita — kiasi cha kununua sokoni kwa siku 3 zijazo."
              : "From your last 14 days of sales — how much to buy at the market for the next 3 days."}
          </p>
          <div className="mt-3 grid gap-2">
            {restockList.slice(0, 6).map((a) => (
              <button key={a.id} onClick={() => openRestock(a.id, a.suggestedQty)} className="flex items-center justify-between gap-3 rounded-xl bg-card p-3 text-left">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold">{a.name}</span>
                    <StatusPill status={a.status} lang={lang} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.perDay > 0
                      ? `${formatQty(a.perDay)} ${a.unit}/${lang === "sw" ? "siku" : "day"} · ${a.daysLeft !== null ? `${formatQty(a.daysLeft)} ${lang === "sw" ? "siku zimebaki" : "days left"}` : "—"}`
                      : lang === "sw" ? "Hakuna mauzo siku 14" : "No sales in 14 days"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-extrabold text-primary">+{formatQty(a.suggestedQty)}</div>
                  <div className="text-[11px] font-semibold text-muted-foreground">{a.unit}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} label={t("empty_products")} cta={t("addProduct")} />
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => {
            const isLow = Number(p.current_stock) <= Number(p.low_stock_threshold);
            const a = adviceById[p.id];
            return (
              <div key={p.id} className={`card-soft p-4 ${isLow ? "border-warning bg-warning/20" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-bold">{p.name}</h3>
                      {isLow && <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-bold text-warning-foreground">{t("lowStock")}</span>}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {formatQty(Number(p.current_stock))} {p.unit} · {formatKsh(Number(p.selling_price))}/{p.unit}
                    </div>
                    {a && (a.perDay > 0 || a.marginPct !== null) && (
                      <div className="mt-1 text-xs font-semibold text-muted-foreground">
                        {a.perDay > 0 && <>{lang === "sw" ? "Huuzwa" : "Sells"} {formatQty(a.perDay)} {p.unit}/{lang === "sw" ? "siku" : "day"}</>}
                        {a.perDay > 0 && a.marginPct !== null && " · "}
                        {a.marginPct !== null && <>{lang === "sw" ? "Faida" : "Margin"} {Math.round(a.marginPct)}%</>}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button onClick={() => openRestock(p.id, a?.suggestedQty ?? 1)} className="tap-target inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 font-semibold text-primary-foreground">
                      <PackagePlus size={16} /> {t("restock")}
                    </button>
                    <button onClick={() => setLosing(p.id)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-danger px-3 py-2 text-xs font-bold text-danger">
                      <Trash2 size={14} /> {lang === "sw" ? "Hasara" : "Log loss"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddProductDialog onClose={() => setShowAdd(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["products"] }); setShowAdd(false); }} />}
      {restocking && <RestockDialog productId={restocking} initialQty={prefillQty} product={products.find((p) => p.id === restocking)!} onClose={() => setRestocking(null)} onSaved={() => { qc.invalidateQueries(); setRestocking(null); }} />}
      {losing && <LossDialog productId={losing} product={products.find((p) => p.id === losing)!} onClose={() => setLosing(null)} onSaved={() => { qc.invalidateQueries(); setLosing(null); }} />}
    </div>
  );
}

function StatusPill({ status, lang }: { status: StockAdvice["status"]; lang: "en" | "sw" }) {
  const map: Record<StockAdvice["status"], { cls: string; en: string; sw: string }> = {
    out: { cls: "bg-danger text-danger-foreground", en: "Out of stock", sw: "Imeisha" },
    urgent: { cls: "bg-danger text-danger-foreground", en: "Buy today", sw: "Nunua leo" },
    soon: { cls: "bg-warning text-warning-foreground", en: "Buy soon", sw: "Nunua karibuni" },
    ok: { cls: "bg-secondary text-foreground", en: "Enough", sw: "Inatosha" },
    slow: { cls: "bg-secondary text-muted-foreground", en: "Slow mover", sw: "Inauzwa polepole" },
  };
  const s = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.cls}`}>{lang === "sw" ? s.sw : s.en}</span>;
}

function LossDialog({ productId, product, onClose, onSaved }: { productId: string; product: any; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useI18n();
  const { refresh } = useOffline();
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState<LossReason>("spoilage");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const lossValue = qty * Number(product?.cost_price ?? 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qty > Number(product.current_stock)) {
      return toast.error(lang === "sw" ? "Kiasi kinazidi stoo iliyopo" : "Quantity is more than current stock");
    }
    setSaving(true);
    try {
      const res = await recordStockLossOfflineFirst({ product_id: productId, quantity: qty, reason, note: note || undefined });
      await refresh();
      toast.success(res.queued
        ? (lang === "sw" ? "Imehifadhiwa — itasawazishwa" : "Saved — will sync")
        : (lang === "sw" ? "Hasara imerekodiwa" : "Loss recorded"));
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title={`${lang === "sw" ? "Rekodi hasara" : "Log loss"}: ${product.name}`}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingDown size={16} />
          {lang === "sw"
            ? "Rekodi mboga zilizoharibika ili hesabu ya stoo na faida iwe sahihi."
            : "Record spoiled produce so your stock count and profit stay accurate."}
        </p>
        <FormField label={`${t("quantity")} (${product.unit})`}>
          <input type="number" min="0.01" step="0.01" required value={qty} onChange={(e) => setQty(Number(e.target.value))} className="tap-target w-full rounded-xl border border-input bg-card px-4 text-xl font-bold" />
        </FormField>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{lang === "sw" ? "Sababu" : "Reason"}</span>
          <div className="flex flex-wrap gap-2">
            {LOSS_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={`rounded-full border px-3 py-2 text-sm font-semibold ${reason === r ? "border-transparent bg-primary text-primary-foreground" : "border-border"}`}>
                {LOSS_LABELS[r][lang]}
              </button>
            ))}
          </div>
        </div>
        <FormField label={t("description")}>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="tap-target w-full rounded-xl border border-input bg-card px-4" />
        </FormField>
        <div className="card-soft flex items-center justify-between bg-danger/10 p-4">
          <span className="font-semibold">{lang === "sw" ? "Thamani ya hasara" : "Value of loss"}</span>
          <span className="text-2xl font-extrabold text-danger">{formatKsh(lossValue)}</span>
        </div>
        <div className="mt-1 flex gap-2">
          <button type="button" onClick={onClose} className="tap-target flex-1 rounded-2xl border border-border font-semibold">{t("cancel")}</button>
          <button disabled={saving} className="tap-target flex-1 rounded-2xl bg-danger font-bold text-danger-foreground">{t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}



function EmptyState({ label, cta, onAdd }: { label: string; cta: string; onAdd: () => void }) {
  return (
    <div className="card-soft flex flex-col items-center gap-3 p-8 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-secondary"><Package className="text-primary" /></div>
      <p className="text-muted-foreground">{label}</p>
      <button onClick={onAdd} className="tap-target rounded-2xl bg-primary px-6 font-bold text-primary-foreground">{cta}</button>
    </div>
  );
}

function AddProductDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: "", unit: "kg", current_stock: 0, low_stock_threshold: 5, cost_price: 0, selling_price: 0 });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("products").insert({ ...form, user_id: u.user!.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  };

  return (
    <Modal onClose={onClose} title={t("addProduct")}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <FormField label={t("product")}><input required value={form.name} onChange={(e) => set("name", e.target.value)} className="tap-target w-full rounded-xl border border-input bg-card px-4" /></FormField>
        <FormField label={t("unit")}>
          <select value={form.unit} onChange={(e) => set("unit", e.target.value)} className="tap-target w-full rounded-xl border border-input bg-card px-4">
            <option value="kg">kg</option><option value="piece">piece</option><option value="bunch">bunch</option><option value="crate">crate</option><option value="bag">bag</option>
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("costPrice")}><input type="number" min="0" step="1" value={form.cost_price} onChange={(e) => set("cost_price", Number(e.target.value))} className="tap-target w-full rounded-xl border border-input bg-card px-4" /></FormField>
          <FormField label={t("sellingPrice")}><input type="number" min="0" step="1" value={form.selling_price} onChange={(e) => set("selling_price", Number(e.target.value))} className="tap-target w-full rounded-xl border border-input bg-card px-4" /></FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("quantity")}><input type="number" min="0" step="0.1" value={form.current_stock} onChange={(e) => set("current_stock", Number(e.target.value))} className="tap-target w-full rounded-xl border border-input bg-card px-4" /></FormField>
          <FormField label={t("lowStockThreshold")}><input type="number" min="0" step="1" value={form.low_stock_threshold} onChange={(e) => set("low_stock_threshold", Number(e.target.value))} className="tap-target w-full rounded-xl border border-input bg-card px-4" /></FormField>
        </div>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onClose} className="tap-target flex-1 rounded-2xl border border-border font-semibold">{t("cancel")}</button>
          <button disabled={saving} className="tap-target flex-1 rounded-2xl bg-primary font-bold text-primary-foreground">{t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}

function RestockDialog({ productId, product, onClose, onSaved }: { productId: string; product: any; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useI18n();
  const { refresh } = useOffline();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await recordRestockOfflineFirst({ product_id: productId, quantity: qty, note: note || undefined });
      await refresh();
      toast.success(res.queued ? (lang === "sw" ? "Imehifadhiwa — itasawazishwa" : "Saved — will sync") : "Stock updated");
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title={`${t("restock")}: ${product.name}`}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Current: {formatQty(Number(product.current_stock))} {product.unit}</p>
        <FormField label={`${t("quantity")} (${product.unit})`}><input type="number" min="0.01" step="0.01" required value={qty} onChange={(e) => setQty(Number(e.target.value))} className="tap-target w-full rounded-xl border border-input bg-card px-4" /></FormField>
        <FormField label={t("description")}><input value={note} onChange={(e) => setNote(e.target.value)} className="tap-target w-full rounded-xl border border-input bg-card px-4" /></FormField>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onClose} className="tap-target flex-1 rounded-2xl border border-border font-semibold">{t("cancel")}</button>
          <button disabled={saving} className="tap-target flex-1 rounded-2xl bg-primary font-bold text-primary-foreground">{t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-sm font-semibold">{label}</span>{children}</label>;
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-xl font-extrabold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
