import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { useOffline } from "@/lib/offline/OfflineProvider";
import { discardReviewItem, retryReviewItem } from "@/lib/offline/sync";
import { useI18n } from "@/lib/i18n";
import { formatQty } from "@/lib/format";

export function SyncReviewCard() {
  const { review, refresh } = useOffline();
  const { lang } = useI18n();
  if (review.length === 0) return null;

  return (
    <section className="card-soft border-2 border-danger/40 p-4">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-danger">
        <AlertTriangle size={20} />
        {lang === "sw" ? "Inahitaji ukaguzi" : "Needs review"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {lang === "sw"
          ? "Hizi hazikuhifadhiwa kwa sababu hisa haitoshi tena. Ongeza hisa kisha jaribu tena, au zitupe."
          : "These were not saved because there is no longer enough stock. Restock and try again, or discard them."}
      </p>
      <div className="mt-3 grid gap-2">
        {review.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-card p-3">
            <div className="font-bold">
              {item.payload?.product_name ?? (lang === "sw" ? "Muuzo" : "Sale")}
              {item.payload?.quantity != null && ` · ${formatQty(Number(item.payload.quantity))}`}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(item.createdAt).toLocaleString(lang === "sw" ? "sw-KE" : "en-KE")}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={async () => { await retryReviewItem(item.id!); await refresh(); }}
                className="tap-target inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground"
              >
                <RotateCcw size={16} /> {lang === "sw" ? "Jaribu tena" : "Try again"}
              </button>
              <button
                onClick={async () => { await discardReviewItem(item.id!); await refresh(); }}
                className="tap-target inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border px-4 text-sm font-semibold"
              >
                <Trash2 size={16} /> {lang === "sw" ? "Tupa" : "Discard"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
