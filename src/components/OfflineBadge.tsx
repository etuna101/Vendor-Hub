import { CloudOff, RefreshCw } from "lucide-react";
import { useOffline } from "@/lib/offline/OfflineProvider";
import { useI18n } from "@/lib/i18n";

export function OfflineBadge() {
  const { online, pending } = useOffline();
  const { lang } = useI18n();

  if (online && pending === 0) return null;

  if (!online) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-3 py-1 text-xs font-bold text-accent-foreground">
        <CloudOff size={14} />
        {lang === "sw" ? "Nje ya mtandao — itasawazishwa" : "Offline — will sync"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-foreground">
      <RefreshCw size={14} className="animate-spin" />
      {lang === "sw" ? `Inasawazisha ${pending}` : `Syncing ${pending}`}
    </span>
  );
}
