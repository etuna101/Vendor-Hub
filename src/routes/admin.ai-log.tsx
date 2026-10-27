import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/ai-log")({ component: AiLogPage });
type Row = { id: string; user_id: string; kind: string; query: string; response: string; language: string; created_at: string; vendor?: { full_name: string; business_name: string; phone: string } | null };

function AiLogPage() {
  const [q, setQ] = useState("");
  const { data: rows, error, isLoading } = useQuery({
    queryKey: ["admin-ai-log"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_interactions").select("id, user_id, kind, query, response, language, created_at").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((row: any) => row.user_id)));
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, full_name, business_name, phone").in("id", ids) : { data: [] };
      const byId = Object.fromEntries((profiles ?? []).map((profile: any) => [profile.id, profile]));
      return (data ?? []).map((row: any) => ({ ...row, vendor: byId[row.user_id] ?? null })) as Row[];
    },
  });
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows ?? [];
    return (rows ?? []).filter((row) => [row.query, row.response, row.vendor?.full_name, row.vendor?.business_name, row.vendor?.phone].some((value) => (value ?? "").toString().toLowerCase().includes(term)));
  }, [rows, q]);

  return <div className="max-w-6xl space-y-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h1 className="text-2xl font-extrabold md:text-3xl">AI Interactions</h1><p className="text-sm text-muted-foreground">Recent questions and answers across all vendors.</p></div><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search question, answer, vendor" className="rounded-xl border bg-card px-4 py-2 text-sm md:w-80" /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
    {isLoading ? <div className="space-y-3" aria-label="Loading">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-primary/10" />)}</div> : !filtered.length ? <p className="text-muted-foreground">No interactions.</p> : <div className="space-y-2">{filtered.map((row) => <article key={row.id} className="rounded-2xl border bg-card p-4"><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-muted px-2 py-0.5 font-semibold uppercase">{row.kind}</span><span className="rounded-full bg-muted px-2 py-0.5 uppercase">{row.language}</span><span>{row.vendor?.business_name || row.vendor?.full_name || row.user_id.slice(0, 8)}</span><span>· {new Date(row.created_at).toLocaleString()}</span></div><div className="mt-2 text-sm"><span className="font-semibold">Q:</span> {row.query}</div><div className="mt-1 text-sm text-muted-foreground"><span className="font-semibold text-foreground">A:</span> {row.response}</div></article>)}</div>}
  </div>;
}
