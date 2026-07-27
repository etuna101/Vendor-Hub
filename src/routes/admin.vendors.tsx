import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/vendors")({ component: VendorsPage });

type Row = {
  user_id: string;
  full_name: string;
  business_name: string;
  phone: string;
  created_at: string;
  sales_count: number;
  total_sales: number;
};

function VendorsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("admin_vendor_overview" as any);
      if (error) setErr(error.message);
      else setRows((data ?? []) as any);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.full_name, r.business_name, r.phone].some((v) => (v ?? "").toLowerCase().includes(s))
    );
  }, [rows, q]);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold">Vendors</h1>
          <p className="text-muted-foreground text-sm">Everyone registered on VendorHub.</p>
        </div>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, business, or phone"
          className="rounded-xl border bg-card px-4 py-2 text-sm md:w-80"
        />
      </div>
      {err && <p className="text-destructive text-sm">{err}</p>}
      <div className="rounded-2xl bg-card border overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground uppercase border-b">
              <th className="p-3">Vendor</th>
              <th className="p-3">Business</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Joined</th>
              <th className="p-3 text-right">Sales</th>
              <th className="p-3 text-right">Volume (KES)</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No vendors found.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.user_id} className="border-b last:border-0">
                <td className="p-3 font-semibold">{r.full_name || "—"}</td>
                <td className="p-3">{r.business_name || "—"}</td>
                <td className="p-3">{r.phone || "—"}</td>
                <td className="p-3">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="p-3 text-right">{r.sales_count}</td>
                <td className="p-3 text-right">{Math.round(Number(r.total_sales)).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
