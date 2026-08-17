/**
 * Stock intelligence helpers.
 *
 * These power the "restock advisor" on the Inventory screen: from a vendor's own
 * recent sales we estimate how fast each product moves, how many days of stock
 * is left, and how much to buy at the next market run. Everything is derived
 * from the vendor's records — no invented numbers.
 */

export type ProductRow = {
  id: string;
  name: string;
  unit: string;
  current_stock: number | string;
  low_stock_threshold: number | string;
  cost_price: number | string;
  selling_price: number | string;
};

export type SaleRow = { product_id?: string | null; quantity: number | string; total: number | string; date: string };

export type StockAdvice = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  perDay: number;
  daysLeft: number | null;
  suggestedQty: number;
  marginPct: number | null;
  status: "out" | "urgent" | "soon" | "ok" | "slow";
};

/** Round to a friendly market quantity (0.5 steps below 10, whole numbers above). */
function tidy(qty: number) {
  if (qty <= 0) return 0;
  return qty < 10 ? Math.round(qty * 2) / 2 : Math.ceil(qty);
}

/**
 * @param coverDays how many days of stock a vendor wants to hold (default 3 — fresh produce spoils)
 */
export function buildStockAdvice(
  products: ProductRow[],
  sales: SaleRow[],
  windowDays = 14,
  coverDays = 3,
): StockAdvice[] {
  const soldQty: Record<string, number> = {};
  for (const s of sales) {
    if (!s.product_id) continue;
    soldQty[s.product_id] = (soldQty[s.product_id] ?? 0) + Math.abs(Number(s.quantity));
  }

  return products
    .map((p) => {
      const stock = Number(p.current_stock);
      const perDay = (soldQty[p.id] ?? 0) / windowDays;
      const daysLeft = perDay > 0 ? stock / perDay : null;
      const cost = Number(p.cost_price);
      const price = Number(p.selling_price);
      const marginPct = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : null;
      const target = perDay * coverDays;
      const suggestedQty = tidy(Math.max(0, target - stock));

      let status: StockAdvice["status"] = "ok";
      if (stock <= 0) status = "out";
      else if (perDay === 0) status = "slow";
      else if (daysLeft !== null && daysLeft < 1) status = "urgent";
      else if (daysLeft !== null && daysLeft <= coverDays) status = "soon";

      return { id: p.id, name: p.name, unit: p.unit, stock, perDay, daysLeft, suggestedQty, marginPct, status };
    })
    .sort((a, b) => rank(a) - rank(b) || b.perDay - a.perDay);
}

function rank(a: StockAdvice) {
  return { out: 0, urgent: 1, soon: 2, ok: 3, slow: 4 }[a.status];
}

export const LOSS_REASONS = ["spoilage", "damage", "theft", "personal_use", "correction"] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

export const LOSS_LABELS: Record<LossReason, { en: string; sw: string }> = {
  spoilage: { en: "Spoiled / rotten", sw: "Imeharibika" },
  damage: { en: "Damaged", sw: "Imevunjika" },
  theft: { en: "Lost / stolen", sw: "Imeibwa" },
  personal_use: { en: "Used at home", sw: "Imetumika nyumbani" },
  correction: { en: "Count correction", sw: "Marekebisho ya hesabu" },
};
