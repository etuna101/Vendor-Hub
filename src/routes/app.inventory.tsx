import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatKsh, formatQty } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Package, AlertTriangle, PackagePlus } from "lucide-react";

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

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

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

      {filtered.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} label={t("empty_products")} cta={t("addProduct")} />
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => {
            const isLow = Number(p.current_stock) <= Number(p.low_stock_threshold);
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
                  </div>
                  <button onClick={() => setRestocking(p.id)} className="tap-target shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 font-semibold text-primary-foreground">
                    <PackagePlus size={16} /> {t("restock")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddProductDialog onClose={() => setShowAdd(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["products"] }); setShowAdd(false); }} />}
      {restocking && <RestockDialog productId={restocking} product={products.find((p) => p.id === restocking)!} onClose={() => setRestocking(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["products"] }); setRestocking(null); }} />}
    </div>
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
  const { t } = useI18n();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.rpc("record_restock", { _product_id: productId, _quantity: qty, _note: note || null });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Stock updated");
    onSaved();
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
