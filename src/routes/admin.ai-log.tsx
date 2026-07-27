import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/ai-log")({ component: AiLogPage });

type Row = {
  id: string;
  user_id: string;
  kind: string;
  query: string;
  response: string;
  language: string;
  created_at: string;
  vendor?: { full_name: string; business_name: string; phone: string } | null;
};

function AiLogPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ai_interactions")
        .select("id, user_id, kind, query, response, language, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) { setErr(error.message); return; }
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
      const { data: profs } = await supabase.from("profiles").select("id, full_name, business_name, phone").in("id", ids);
      const map: Record<string, any> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p; });
      setRows((data ?? []).map((r: any) => ({ ...r, vendor: map[r.user_id] ?? null })));
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.query, r.response, r.vendor?.full_name, r.vendor?.business_name, r.vendor?.phone]
        .some((v) => (v ?? "").toString().toLowerCase().includes(s))
    );
  }, [rows, q]);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold">AI Interactions</h1>
          <p className="text-muted-foreground text-sm">Recent questions and answers across all vendors.</p>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search question, answer, vendor"
          className="rounded-xl border bg-card px-4 py-2 text-sm md:w-80" />
      </div>
      {err && <p className="text-destructive text-sm">{err}</p>}
      <div className="space-y-2">
        {rows === null ? <p className="text-muted-foreground">Loading…</p>
          : filtered.length === 0 ? <p className="text-muted-foreground">No interactions.</p>
          : filtered.map((r) => (
          <div key={r.id} className="rounded-2xl bg-card border p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5 font-semibold uppercase">{r.kind}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 uppercase">{r.language}</span>
              <span>{r.vendor?.business_name || r.vendor?.full_name || r.user_id.slice(0, 8)}</span>
              <span>· {new Date(r.created_at).toLocaleString()}</span>
            </div>
            <div className="mt-2 text-sm"><span className="font-semibold">Q:</span> {r.query}</div>
            <div className="mt-1 text-sm text-muted-foreground"><span className="font-semibold text-foreground">A:</span> {r.response}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
