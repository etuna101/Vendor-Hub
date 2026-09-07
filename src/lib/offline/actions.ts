import { supabase } from "@/integrations/supabase/client";
import { getDB, enqueue, newLocalId } from "./db";

export function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

/**
 * Reads a list with an offline fallback: online results refresh the local mirror,
 * offline reads come straight from IndexedDB (pending rows included).
 */
export async function offlineList<T>(
  table: "products" | "sales" | "expenses" | "credit_payments",
  fetcher: () => Promise<T[]>,
  filter?: (row: any) => boolean,
): Promise<T[]> {
  const db = getDB();
  if (!isOffline()) {
    try {
      const rows = await fetcher();
      if (db) {
        const pending = await (db as any)[table].filter((r: any) => r._pending).toArray();
        await (db as any)[table].bulkPut(rows as any[]);
        return [...pending, ...(rows as any[])].filter((r) => (filter ? filter(r) : true)) as T[];
      }
      return rows;
    } catch (err) {
      if (!db) throw err;
    }
  }
  if (!db) return [];
  const rows = await (db as any)[table].toArray();
  return (rows as any[]).filter((r) => (filter ? filter(r) : true)) as T[];
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
  const localRowId = newLocalId();
  if (db) {
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
  const localRowId = newLocalId();
  if (db) {
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
      await supabase.from("sales").update({ credit_paid: true } as any).eq("id", input.sale_id);
    }
    return { queued: false };
  }
  const db = getDB();
  const localRowId = newLocalId();
  if (db) {
    await db.credit_payments.put({
      id: localRowId,
      user_id: userId,
      sale_id: input.sale_id,
      amount: input.amount,
      note: input.note ?? null,
      date: new Date().toISOString(),
      _pending: true,
    });
  }
  await enqueue("credit_payment", { ...input, user_id: userId, local_row_id: localRowId });
  return { queued: true };
}

export async function recordRestockOfflineFirst(input: {
  product_id: string;
  quantity: number;
  note?: string;
}) {
  await currentUserId();
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
  if (db) {
    const product = await db.products.get(input.product_id);
    if (product) {
      await db.products.put({ ...product, current_stock: Number(product.current_stock) + input.quantity });
    }
  }
  await enqueue("restock", input);
  return { queued: true };
}

/** Log spoiled / damaged / lost stock. Works offline and syncs later. */
export async function recordStockLossOfflineFirst(input: {
  product_id: string;
  quantity: number;
  reason: string;
  note?: string;
}) {
  await currentUserId();
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
  if (db) {
    const product = await db.products.get(input.product_id);
    if (product) {
      await db.products.put({ ...product, current_stock: Number(product.current_stock) - input.quantity });
    }
  }
  await enqueue("loss", input);
  return { queued: true };
}
