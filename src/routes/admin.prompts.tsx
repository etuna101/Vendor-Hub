import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/prompts")({ component: PromptsPage });

type Row = { id: string; key: string; content: string; updated_at: string };

const LABELS: Record<string, string> = {
  insight_en: "Dashboard Insight — English",
  insight_sw: "Dashboard Insight — Kiswahili",
  chat_en: "Assistant Chat — English",
  chat_sw: "Assistant Chat — Kiswahili",
};

function PromptsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from("system_prompts").select("id, key, content, updated_at").order("key");
    if (error) { toast.error(error.message); return; }
    setRows(data as any);
    const e: Record<string, string> = {};
    (data ?? []).forEach((r: any) => { e[r.id] = r.content; });
    setEdits(e);
  };

  useEffect(() => { load(); }, []);

  const save = async (row: Row) => {
    setSaving(row.id);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("system_prompts").update({
      content: edits[row.id],
      updated_by: userData.user?.id ?? null,
    }).eq("id", row.id);
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success("Prompt saved");
    load();
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold">System Prompts</h1>
        <p className="text-muted-foreground text-sm">Edit the instructions VendorHub's AI advisor follows. Changes take effect on the next request.</p>
      </div>
      {rows === null ? <p className="text-muted-foreground">Loading…</p> : rows.map((r) => (
        <div key={r.id} className="rounded-2xl bg-card border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">{LABELS[r.key] ?? r.key}</div>
              <div className="text-xs text-muted-foreground">Updated {new Date(r.updated_at).toLocaleString()}</div>
            </div>
            <code className="text-xs rounded bg-muted px-2 py-1">{r.key}</code>
          </div>
          <textarea
            value={edits[r.id] ?? ""}
            onChange={(e) => setEdits((s) => ({ ...s, [r.id]: e.target.value }))}
            rows={7}
            className="w-full rounded-xl border bg-background p-3 text-sm font-mono"
          />
          <div className="flex justify-end">
            <button
              onClick={() => save(r)}
              disabled={saving === r.id || edits[r.id] === r.content}
              className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {saving === r.id ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
