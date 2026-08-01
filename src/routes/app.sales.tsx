import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineList, recordSaleOfflineFirst } from "@/lib/offline/actions";
import { useOffline } from "@/lib/offline/OfflineProvider";
import { useI18n } from "@/lib/i18n";
import { QuickFilterBar, getPeriodRange, type PeriodKey } from "@/components/QuickFilterBar";
import { formatKsh, formatQty } from "@/lib/format";
import { toast } from "sonner";
import { Plus, ShoppingCart, CloudOff } from "lucide-react";
import { Modal } from "./app.inventory";


export const Route = createFileRoute("/app/sales")({ component: SalesScreen });

function SalesScreen() {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [open, setOpen] = useState(false);
  const { from, to } = getPeriodRange(period);
  const qc = useQueryClient();

  const { data: sales = [] } = useQuery({
    queryKey: ["sales", period],
    queryFn: () =>
      offlineList<any>("sales", async () => {
        const { data, error } = await supabase.from("sales").select("*, customers(name)").gte("date", from.toISOString()).lte("date", to.toISOString()).order("date", { ascending: false });
        if (error) throw error;
        return data ?? [];
      }, (r) => {
        const d = new Date(r.date).getTime();
        return d >= from.getTime() && d <= to.getTime();
      }).then((rows) => rows.sort((a, b) => +new Date(b.date) - +new Date(a.date))),
  });

  const total = sales.reduce((s: number, r: any) => s + Number(r.total), 0);


  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t("sales")}</h1>
        <button onClick={() => setOpen(true)} className="tap-target inline-flex items-center gap-2 rounded-2xl bg-primary px-4 font-bold text-primary-foreground">
          <Plus size={18} /> {t("newSale")}
        </button>
      </div>
      <QuickFilterBar value={period} onChange={setPeriod} />
      <div className="card-soft flex items-center justify-between p-4">
        <span className="text-sm text-muted-foreground">{t("totalSales")} — {t(period)}</span>
        <span className="text-xl font-extrabold text-primary">{formatKsh(total)}</span>
      </div>
      {sales.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 p-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-secondary"><ShoppingCart className="text-primary" /></div>
          <p className="text-muted-foreground">{t("empty_sales")}</p>
          <button onClick={() => setOpen(true)} className="tap-target rounded-2xl bg-primary px-6 font-bold text-primary-foreground">{t("newSale")}</button>
        </div>
      ) : (
        <div className="grid gap-2">
          {sales.map((s: any) => (
            <div key={s.id} className="card-soft flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-bold">{s.product_name_snapshot}</span>
                  {s.is_credit && !s.credit_paid && <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-danger-foreground">{lang === "en" ? "Credit" : "Deni"}</span>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatQty(Number(s.quantity))} × {formatKsh(Number(s.unit_price))}
                  {s.customers?.name ? ` · ${s.customers.name}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">{new Date(s.date).toLocaleString(lang === "sw" ? "sw-KE" : "en-KE")}</div>
              </div>
              <div className="text-right text-lg font-extrabold">{formatKsh(Number(s.total))}</div>
            </div>
          ))}
        </div>
      )}
      {open && <NewSaleDialog onClose={() => setOpen(false)} onSaved={() => { qc.invalidateQueries(); setOpen(false); }} />}
    </div>
  );
}

function NewSaleDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useI18n();
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [customerId, setCustomerId] = useState<string>("");
  const [isCredit, setIsCredit] = useState(false);
  const [dueDate, setDueDate] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, unit, selling_price, current_stock").eq("is_active", true).order("name");
      return data ?? [];
    },
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name").order("name");
      return data ?? [];
    },
  });

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const unitPrice = product ? Number(product.selling_price) : 0;
  const total = qty * unitPrice;

  const [newCustomer, setNewCustomer] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return toast.error("Pick a product");
    setSaving(true);
    let cid: string | null = customerId || null;
    if (isCredit && !cid && newCustomer.trim()) {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("customers").insert({ name: newCustomer.trim(), user_id: u.user!.id }).select("id").single();
      if (error) { setSaving(false); return toast.error(error.message); }
      cid = data.id;
    }
    const { data: saleId, error } = await supabase.rpc("record_sale" as any, {
      _product_id: productId, _quantity: qty, _unit_price: unitPrice, _customer_id: cid, _is_credit: isCredit,
    } as any);
    if (error) { setSaving(false); return toast.error(error.message); }
    if (isCredit && dueDate && saleId) {
      await supabase.from("sales").update({ due_date: dueDate } as any).eq("id", saleId as any);
    }
    setSaving(false);
    toast.success(lang === "en" ? "Sale recorded" : "Muuzo umehifadhiwa");
    onSaved();
  };

  return (
    <Modal onClose={onClose} title={t("newSale")}>
      {products.length === 0 ? (
        <p className="text-muted-foreground">{t("empty_products")}</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{t("product")}</span>
            <select required value={productId} onChange={(e) => setProductId(e.target.value)} className="tap-target rounded-xl border border-input bg-card px-3">
              <option value="">—</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({formatQty(Number(p.current_stock))} {p.unit} · {formatKsh(Number(p.selling_price))})</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{t("quantity")} {product ? `(${product.unit})` : ""}</span>
            <input type="number" min="0.01" step="0.01" required value={qty} onChange={(e) => setQty(Number(e.target.value))} className="tap-target rounded-xl border border-input bg-card px-4 text-xl font-bold" />
          </label>
          <div className="card-soft flex items-center justify-between bg-secondary p-4">
            <span className="font-semibold">{t("total")}</span>
            <span className="text-2xl font-extrabold text-primary">{formatKsh(total)}</span>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-border p-3">
            <input type="checkbox" checked={isCredit} onChange={(e) => setIsCredit(e.target.checked)} className="h-5 w-5 accent-primary" />
            <span className="font-semibold">{t("onCredit")}</span>
          </label>
          {isCredit && (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold">{t("customer")}</span>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="tap-target rounded-xl border border-input bg-card px-3">
                  <option value="">{lang === "en" ? "— pick or add new below —" : "— chagua au ongeza mpya —"}</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              {!customerId && (
                <input placeholder={lang === "en" ? "New customer name" : "Jina la mteja mpya"} value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} className="tap-target rounded-xl border border-input bg-card px-4" />
              )}
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold">{lang === "en" ? "Due date (optional)" : "Tarehe ya kulipa (hiari)"}</span>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="tap-target rounded-xl border border-input bg-card px-3" />
              </label>
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onClose} className="tap-target flex-1 rounded-2xl border border-border font-semibold">{t("cancel")}</button>
            <button disabled={saving} className="tap-target flex-1 rounded-2xl bg-primary font-bold text-primary-foreground">{t("save")}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
