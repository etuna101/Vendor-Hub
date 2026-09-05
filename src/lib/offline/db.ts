import Dexie, { type Table } from "dexie";

export type QueueKind = "sale" | "expense" | "restock" | "loss" | "credit_payment" | "product";
export type QueueStatus = "pending" | "syncing" | "needs_review" | "done";

export interface QueueItem {
  id?: number;
  localId: string;
  kind: QueueKind;
  payload: any;
  createdAt: number;
  status: QueueStatus;
  attempts: number;
  reviewReason?: string;
}

/** Local mirrors of the server tables so screens keep working with no connection. */
export interface LocalProduct {
  id: string;
  user_id: string;
  name: string;
  unit: string;
  current_stock: number;
  low_stock_threshold: number;
  cost_price: number;
  selling_price: number;
  is_active: boolean;
  updated_at?: string;
  _pending?: boolean;
}

export interface LocalSale {
  id: string;
  user_id: string;
  product_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  total: number;
  customer_id: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  is_credit: boolean;
  credit_paid: boolean;
  date: string;
  due_date?: string | null;
  _pending?: boolean;
}

export interface LocalExpense {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  description: string | null;
  date: string;
  _pending?: boolean;
}

export interface LocalCreditPayment {
  id: string;
  user_id: string;
  sale_id: string;
  amount: number;
  note: string | null;
  date: string;
  _pending?: boolean;
}

class VendorHubDB extends Dexie {
  products!: Table<LocalProduct, string>;
  sales!: Table<LocalSale, string>;
  expenses!: Table<LocalExpense, string>;
  credit_payments!: Table<LocalCreditPayment, string>;
  queue!: Table<QueueItem, number>;

  constructor() {
    super("vendorhub");
    this.version(1).stores({
      products: "id, user_id, name, is_active",
      sales: "id, user_id, date, product_id, is_credit",
      expenses: "id, user_id, date, category",
      credit_payments: "id, user_id, sale_id, date",
      queue: "++id, localId, kind, status, createdAt",
    });
  }
}

let _db: VendorHubDB | null = null;

/** Dexie only exists in the browser — never touch it during SSR. */
export function getDB(): VendorHubDB | null {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return null;
  if (!_db) _db = new VendorHubDB();
  return _db;
}

export function newLocalId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueue(kind: QueueKind, payload: any) {
  const db = getDB();
  if (!db) return null;
  const localId = newLocalId();
  await db.queue.add({ localId, kind, payload, createdAt: Date.now(), status: "pending", attempts: 0 });
  return localId;
}

export async function pendingCount() {
  const db = getDB();
  if (!db) return 0;
  return db.queue.where("status").anyOf("pending", "syncing").count();
}

export async function reviewItems() {
  const db = getDB();
  if (!db) return [];
  return db.queue.where("status").equals("needs_review").toArray();
}
