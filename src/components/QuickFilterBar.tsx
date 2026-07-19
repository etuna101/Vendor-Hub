import { useI18n } from "@/lib/i18n";

export type PeriodKey = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "last3Months" | "thisYear";

export function getPeriodRange(key: PeriodKey): { from: Date; to: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  switch (key) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now); y.setDate(now.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "thisWeek": {
      const d = new Date(now); const day = (d.getDay() + 6) % 7; // Mon start
      d.setDate(d.getDate() - day);
      return { from: startOfDay(d), to: endOfDay(now) };
    }
    case "lastWeek": {
      const d = new Date(now); const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day - 7);
      const end = new Date(d); end.setDate(d.getDate() + 6);
      return { from: startOfDay(d), to: endOfDay(end) };
    }
    case "thisMonth": {
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    }
    case "lastMonth": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from, to };
    }
    case "last3Months": {
      const from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      return { from, to: endOfDay(now) };
    }
    case "thisYear": {
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    }
  }
}

const KEYS: PeriodKey[] = ["today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "lastMonth", "last3Months", "thisYear"];

export function QuickFilterBar({ value, onChange }: { value: PeriodKey; onChange: (k: PeriodKey) => void }) {
  const { t } = useI18n();
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex gap-2 pb-1">
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => onChange(k)}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              value === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground"
            }`}
          >
            {t(k)}
          </button>
        ))}
      </div>
    </div>
  );
}
