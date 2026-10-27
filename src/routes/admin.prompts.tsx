import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/prompts")({ component: PromptsPage });
type Row = { id: string; key: string; content: string; updated_at: string };
const LABELS: Record<string, string> = {
  insight_en: "Dashboard Insight — English", insight_sw: "Dashboard Insight — Kiswahili",
  chat_en: "Assistant Chat — English", chat_sw: "Assistant Chat — Kiswahili",
};

function PromptsPage() {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const { data: rows, error, isLoading } = useQuery({
    queryKey: ["admin-system-prompts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("system_prompts").select("id, key, content, updated_at").order("key");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const save = async (row: Row) => {
    setSaving(row.id);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("system_prompts").update({ content: edits[row.id] ?? row.content, updated_by: userData.user?.id ?? null }).eq("id", row.id);
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success("Prompt saved");
    setEdits((current) => ({ ...current, [row.id]: row.content }));
    await queryClient.invalidateQueries({ queryKey: ["admin-system-prompts"] });
  };

  return <div className="max-w-4xl space-y-4">
    <header><h1 className="text-2xl font-extrabold md:text-3xl">System Prompts</h1><p className="text-sm text-muted-foreground">Edit the instructions VendorHub's AI advisor follows. Changes take effect on the next request.</p></header>
    {isLoading ? <div className="space-y-3" aria-label="Loading">{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-primary/10" />)}</div>
      : error ? <p role="alert" className="text-sm text-destructive">{error.message}</p>
      : (rows ?? []).map((row) => <section key={row.id} className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between"><div><div className="font-bold">{LABELS[row.key] ?? row.key}</div><div className="text-xs text-muted-foreground">Updated {new Date(row.updated_at).toLocaleString()}</div></div><code className="rounded bg-muted px-2 py-1 text-xs">{row.key}</code></div>
        <textarea value={edits[row.id] ?? row.content} onChange={(event) => setEdits((current) => ({ ...current, [row.id]: event.target.value }))} rows={7} className="w-full rounded-xl border bg-background p-3 font-mono text-sm" />
        <div className="flex justify-end"><button onClick={() => save(row)} disabled={saving === row.id || (edits[row.id] ?? row.content) === row.content} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{saving === row.id ? "Saving…" : "Save changes"}</button></div>
      </section>)}
  </div>;
}
