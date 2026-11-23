import { Logo } from "./Logo";
import { OfflineBadge } from "./OfflineBadge";
import { useI18n, type Lang } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import { CircleUserRound } from "lucide-react";

export function TopBar({ right }: { right?: React.ReactNode }) {
  const { lang, setLang } = useI18n();
  return (
    <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center justify-between gap-1 border-b border-border bg-background/95 px-2 backdrop-blur sm:gap-2 sm:px-4">
      <Logo size={32} />
      <div className="flex min-w-0 items-center gap-2">
        <OfflineBadge />
        {right}
        <Link to="/app/profile" aria-label={lang === "sw" ? "Wasifu wangu" : "My profile"} title={lang === "sw" ? "Wasifu wangu" : "My profile"} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <CircleUserRound size={20} />
        </Link>
        <div className="flex shrink-0 rounded-full border border-border bg-card p-0.5 text-xs font-semibold sm:text-sm">
          {(["en", "sw"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-full px-2.5 py-1 uppercase sm:px-3 ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
