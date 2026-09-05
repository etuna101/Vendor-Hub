import { supabase } from "@/integrations/supabase/client";
import { getDB, type QueueItem } from "./db";

export type SyncResult = { synced: number; needsReview: number };

function isStockConflict(message: string) {
  const m = message.toLowerCase();
  return m.includes("insufficient stock") || m.includes("product not found") || m.includes("exceeds current stock");
}

/** Replay one queued action against the backend. Throws for retryable errors. */
async function replay(item: QueueItem) {
  const db = getDB()!;
  const p = item.payload;

  if (item.kind === "sale") {
    let customerId: string | null = p.customer_id ?? null;
    if (!customerId && p.new_customer_name) {
      const { data, error } = await supabase
        .from("customers")
        .insert({ name: p.new_customer_name, phone: p.customer_phone ?? null, user_id: p.user_id })
        .select("id")
        .single();
      if (error) throw error;
      customerId = data.id;
    }
    if (p.is_credit && customerId && p.customer_phone) {
      const { error } = await supabase
        .from("customers")
        .update({ phone: p.customer_phone })
        .eq("id", customerId);
      if (error) throw error;
    }
    const { data: saleId, error } = await supabase.rpc("record_sale" as any, {
      _product_id: p.product_id,
      _quantity: p.quantity,
      _unit_price: p.unit_price,
      _customer_id: customerId,
      _is_credit: p.is_credit,
    } as any);
    if (error) throw error;
    if (p.is_credit && p.due_date && saleId) {
      await supabase.from("sales").update({ due_date: p.due_date } as any).eq("id", saleId as any);
    }
    await db.sales.delete(p.local_row_id);
    return;
  }

  if (item.kind === "expense") {
    const { error } = await supabase.from("expenses").insert({
      user_id: p.user_id,
      category: p.category,
      amount: p.amount,
      description: p.description,
    } as any);
    if (error) throw error;
    await db.expenses.delete(p.local_row_id);
    return;
  }

  if (item.kind === "restock") {
    const { error } = await supabase.rpc("record_restock" as any, {
      _product_id: p.product_id,
      _quantity: p.quantity,
      _note: p.note ?? null,
    } as any);
    if (error) throw error;
    return;
  }

  if (item.kind === "loss") {
    const { error } = await supabase.rpc("record_stock_loss" as any, {
      _product_id: p.product_id,
      _quantity: p.quantity,
      _reason: p.reason,
      _note: p.note ?? null,
    } as any);
    if (error) throw error;
    return;
  }

  if (item.kind === "credit_payment") {
    const { error } = await supabase.from("credit_payments").insert({
      user_id: p.user_id,
      sale_id: p.sale_id,
      amount: p.amount,
      note: p.note ?? null,
    } as any);
    if (error) throw error;
    if (p.mark_paid) {
      await supabase.from("sales").update({ credit_paid: true } as any).eq("id", p.sale_id);
    }
    await db.credit_payments.delete(p.local_row_id);
    return;
  }

  if (item.kind === "product") {
    const { error } = await supabase.from("products").insert(p.row as any);
    if (error) throw error;
    await db.products.delete(p.local_row_id);
    return;
  }
}

let running = false;

/** Replays the pending queue in the order the vendor made the actions. */
export async function processQueue(): Promise<SyncResult> {
  const db = getDB();
  if (!db || running || typeof navigator === "undefined" || !navigator.onLine) {
    return { synced: 0, needsReview: 0 };
  }
  running = true;
  let synced = 0;
  let needsReview = 0;
  try {
    const items = await db.queue.where("status").equals("pending").sortBy("createdAt");
    for (const item of items) {
      await db.queue.update(item.id!, { status: "syncing" });
      try {
        await replay(item);
        await db.queue.delete(item.id!);
        synced++;
      } catch (err: any) {
        const message = String(err?.message ?? err ?? "Sync failed");
        if (isStockConflict(message)) {
          // Stock would go negative (sold elsewhere first) — never apply silently.
          await db.queue.update(item.id!, { status: "needs_review", reviewReason: message });
          needsReview++;
        } else {
          await db.queue.update(item.id!, {
            status: "pending",
            attempts: (item.attempts ?? 0) + 1,
          });
          break; // keep order: stop on the first retryable failure
        }
      }
    }
  } finally {
    running = false;
  }
  return { synced, needsReview };
}

/** Drop a reviewed item the vendor chose to discard. */
export async function discardReviewItem(queueId: number) {
  const db = getDB();
  if (!db) return;
  const item = await db.queue.get(queueId);
  if (item?.payload?.local_row_id) {
    await db.sales.delete(item.payload.local_row_id).catch(() => {});
  }
  await db.queue.delete(queueId);
}

/** Try the queued action again (e.g. after restocking). */
export async function retryReviewItem(queueId: number) {
  const db = getDB();
  if (!db) return;
  await db.queue.update(queueId, { status: "pending", reviewReason: undefined });
  return processQueue();
}
