import { Logo } from "./Logo";
import { OfflineBadge } from "./OfflineBadge";
import { useI18n, type Lang } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import { CircleUserRound } from "lucide-react";

export function TopBar({ right }: { right?: React.ReactNode }) {
  const { lang, setLang } = useI18n();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur">
      <Logo size={32} />
      <div className="flex min-w-0 items-center gap-2">
        <OfflineBadge />
        {right}
        <Link to="/app/profile" aria-label={lang === "sw" ? "Wasifu wangu" : "My profile"} title={lang === "sw" ? "Wasifu wangu" : "My profile"} className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
          <CircleUserRound size={20} />
        </Link>
        <div className="flex rounded-full border border-border bg-card p-0.5 text-sm font-semibold">
          {(["en", "sw"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-full px-3 py-1 uppercase ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
