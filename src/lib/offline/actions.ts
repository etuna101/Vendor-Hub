import { supabase } from "@/integrations/supabase/client";
import { getDB, enqueue, newLocalId } from "./db";

export function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

/**
 * Reads a list with an offline fallback: online results refresh the local mirror,
 * offline reads come straight from IndexedDB (pending rows included).
 */
export async function offlineList<T>(
  table: "products" | "sales" | "expenses" | "credit_payments" | "stock_history",
  fetcher: () => Promise<T[]>,
  filter?: (row: any) => boolean,
): Promise<T[]> {
  const db = getDB();
  const userId = await currentUserId();
  if (!db) return isOffline() ? [] : fetcher();

  const cachedRows = async () => (await (db as any)[table].toArray())
    .filter((row: any) => row.user_id === userId && (!filter || filter(row))) as T[];
  const pendingRows = async () => (await (db as any)[table].filter((row: any) => row._pending && row.user_id === userId).toArray()) as T[];
  const cached = await cachedRows();
  if (isOffline()) return cached;

  let returnedFallback = false;
  const remote = fetcher().then(async (rows) => {
    const ownedRows = rows.filter((row: any) => row.user_id === userId);
    // Some screens fetch only the columns they need. Merge those projections
    // into the mirror so they don't erase richer rows cached by other screens.
    const cacheableRows = ownedRows.filter((row: any) => row.id);
    for (const row of cacheableRows) {
      const previous = await (db as any)[table].get(row.id);
      await (db as any)[table].put({ ...previous, ...row });
    }
    if (returnedFallback && cached.length === 0 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("vendorhub:offline-cache-updated", { detail: { table } }));
    }
    return ownedRows;
  });
  // If the connection is slow, allow navigation to use the local mirror while
  // the request continues and refreshes IndexedDB for the next visit.
  remote.catch(() => {});
  const timeout = new Promise<null>((resolve) => window.setTimeout(() => { returnedFallback = true; resolve(null); }, cached.length ? 700 : 1800));
  const result = await Promise.race([remote.then((rows) => rows), timeout]);
  if (result) {
    const pending = await pendingRows();
    return [...pending, ...result].filter((row: any) => !filter || filter(row)) as T[];
  }
  return cached;
}

export async function recordSaleOfflineFirst(input: {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  customer_id: string | null;
  new_customer_name?: string;
  customer_phone?: string;
  is_credit: boolean;
  due_date?: string | null;
}) {
  const userId = await currentUserId();
  const db = getDB();

  if (!isOffline()) {
    let customerId = input.customer_id;
    if (input.is_credit && !customerId && input.new_customer_name?.trim()) {
      const { data, error } = await supabase
        .from("customers")
        .insert({ name: input.new_customer_name.trim(), phone: input.customer_phone?.trim() || null, user_id: userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      customerId = data.id;
    }
    if (input.is_credit && customerId && input.customer_phone?.trim()) {
      const { error } = await supabase
        .from("customers")
        .update({ phone: input.customer_phone.trim() })
        .eq("id", customerId);
      if (error) throw new Error(error.message);
    }
    const { data: saleId, error } = await supabase.rpc("record_sale" as any, {
      _product_id: input.product_id,
      _quantity: input.quantity,
      _unit_price: input.unit_price,
      _customer_id: customerId,
      _is_credit: input.is_credit,
    } as any);
    if (error) throw new Error(error.message);
    if (input.is_credit && input.due_date && saleId) {
      await supabase.from("sales").update({ due_date: input.due_date } as any).eq("id", saleId as any);
    }
    return { queued: false, sale_id: (saleId as string | null) ?? null, total: input.quantity * input.unit_price };
  }

  // Offline: write locally + queue, and reflect it in the UI right away.
  if (!db) throw new Error("Offline storage is unavailable in this browser. Reconnect before recording the sale.");
  const localRowId = newLocalId();
  {
    await db.sales.put({
      id: localRowId,
      user_id: userId,
      product_id: input.product_id,
      product_name_snapshot: input.product_name,
      quantity: input.quantity,
      unit_price: input.unit_price,
      total: input.quantity * input.unit_price,
      customer_id: input.customer_id,
      customer_name: input.new_customer_name ?? null,
      customer_phone: input.customer_phone ?? null,
      customers: input.new_customer_name ? { name: input.new_customer_name, phone: input.customer_phone ?? null } : null,
      is_credit: input.is_credit,
      credit_paid: false,
      date: new Date().toISOString(),
      due_date: input.due_date ?? null,
      _pending: true,
    });
    const product = await db.products.get(input.product_id);
    if (product) {
      await db.products.put({
        ...product,
        current_stock: Number(product.current_stock) - input.quantity,
      });
    }
  }
  await enqueue("sale", { ...input, user_id: userId, local_row_id: localRowId });
  return { queued: true, sale_id: null, total: input.quantity * input.unit_price };
}

export async function recordExpenseOfflineFirst(input: {
  category: string;
  amount: number;
  description: string;
}) {
  const userId = await currentUserId();
  if (!isOffline()) {
    const { error } = await supabase.from("expenses").insert({ ...input, user_id: userId } as any);
    if (error) throw new Error(error.message);
    return { queued: false };
  }
  const db = getDB();
  if (!db) throw new Error("Offline storage is unavailable in this browser. Reconnect before recording the expense.");
  const localRowId = newLocalId();
  {
    await db.expenses.put({
      id: localRowId,
      user_id: userId,
      category: input.category,
      amount: input.amount,
      description: input.description,
      date: new Date().toISOString(),
      _pending: true,
    });
  }
  await enqueue("expense", { ...input, user_id: userId, local_row_id: localRowId });
  return { queued: true };
}

export async function recordCreditPaymentOfflineFirst(input: {
  sale_id: string;
  amount: number;
  note?: string;
  mark_paid?: boolean;
}) {
  const userId = await currentUserId();
  if (!isOffline()) {
    const { error } = await supabase
      .from("credit_payments")
      .insert({ sale_id: input.sale_id, amount: input.amount, note: input.note ?? null, user_id: userId } as any);
    if (error) throw new Error(error.message);
    if (input.mark_paid) {
      const { error: paidError } = await supabase.from("sales").update({ credit_paid: true } as any).eq("id", input.sale_id);
      if (paidError) console.error("Credit payment saved, but marking the sale paid failed:", paidError);
    }
    return { queued: false };
  }
  const db = getDB();
  if (!db) throw new Error("Offline storage is unavailable in this browser. Reconnect before recording the payment.");
  const localRowId = newLocalId();
  {
    await db.credit_payments.put({
      id: localRowId,
      user_id: userId,
      sale_id: input.sale_id,
      amount: input.amount,
      note: input.note ?? null,
      date: new Date().toISOString(),
      _pending: true,
    });
    if (input.mark_paid) {
      const sale = await db.sales.get(input.sale_id);
      if (sale) await db.sales.put({ ...sale, credit_paid: true });
    }
  }
  await enqueue("credit_payment", { ...input, user_id: userId, local_row_id: localRowId });
  return { queued: true };
}

export async function recordRestockOfflineFirst(input: {
  product_id: string;
  quantity: number;
  note?: string;
}) {
  const userId = await currentUserId();
  if (!isOffline()) {
    const { error } = await supabase.rpc("record_restock" as any, {
      _product_id: input.product_id,
      _quantity: input.quantity,
      _note: input.note ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return { queued: false };
  }
  const db = getDB();
  if (!db) throw new Error("Offline storage is unavailable in this browser. Reconnect before recording the restock.");
  {
    const product = await db.products.get(input.product_id);
    if (product) {
      await db.products.put({ ...product, current_stock: Number(product.current_stock) + input.quantity });
    }
  }
  await enqueue("restock", { ...input, user_id: userId });
  return { queued: true };
}

/** Log spoiled / damaged / lost stock. Works offline and syncs later. */
export async function recordStockLossOfflineFirst(input: {
  product_id: string;
  quantity: number;
  reason: string;
  note?: string;
}) {
  const userId = await currentUserId();
  if (!isOffline()) {
    const { error } = await supabase.rpc("record_stock_loss" as any, {
      _product_id: input.product_id,
      _quantity: input.quantity,
      _reason: input.reason,
      _note: input.note ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return { queued: false };
  }
  const db = getDB();
  if (!db) throw new Error("Offline storage is unavailable in this browser. Reconnect before recording the stock loss.");
  {
    const product = await db.products.get(input.product_id);
    if (product) {
      await db.products.put({ ...product, current_stock: Number(product.current_stock) - input.quantity });
    }
  }
  await enqueue("loss", { ...input, user_id: userId });
  return { queued: true };
}

export async function recordProductOfflineFirst(input: {
  name: string;
  unit: string;
  current_stock: number;
  low_stock_threshold: number;
  cost_price: number;
  selling_price: number;
}) {
  const userId = await currentUserId();
  const db = getDB();
  if (isOffline() && !db) throw new Error("Offline storage is unavailable in this browser. Reconnect before adding a product.");
  const row = { ...input, id: newLocalId(), user_id: userId, is_active: true, _pending: true };
  if (!isOffline()) {
    const { data, error } = await supabase.from("products").insert({ ...input, user_id: userId }).select("*").single();
    if (error) throw new Error(error.message);
    if (db) await db.products.put(data as any);
    return { queued: false };
  }
  await db!.products.put(row as any);
  await enqueue("product", { user_id: userId, row });
  return { queued: true };
}
