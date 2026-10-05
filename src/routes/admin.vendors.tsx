import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useVendorAction, useVendors, type AdminVendor } from "@/lib/profile";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/vendors")({ component: VendorsPage });
const PAGE_SIZE = 10;
function VendorsPage() {
  const { data: rows = [], isLoading, error } = useVendors();
  const action = useVendorAction();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => rows.filter((row) =>
    (status === "all" || row.approval_status === status) &&
    [row.full_name, row.business_name, row.phone, row.email].some((value) => value?.toLowerCase().includes(query.trim().toLowerCase()))
  ), [rows, status, query]);
  const count = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pending = rows.filter((row) => row.approval_status === "pending").length;
  const run = async (row: AdminVendor, kind: "approve_vendor" | "reject_vendor" | "suspend_vendor" | "reinstate_vendor") => {
    const reason = kind === "reject_vendor" ? window.prompt("Optional reason for rejection:") : undefined;
    if (kind === "reject_vendor" && reason === null) return;
    try { await action.mutateAsync({ id: row.user_id, action: kind, reason: reason ?? undefined }); toast.success("Vendor status updated"); }
    catch { toast.error("Could not update vendor status"); }
  };
  return <section className="max-w-6xl space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-extrabold">Vendors <span className="rounded-full bg-amber-100 px-2 py-1 text-sm text-amber-900">{pending} pending</span></h1><p className="text-sm text-muted-foreground">Review and manage vendor accounts.</p></div>
      <div className="flex gap-2"><input aria-label="Search vendors" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Search name, business, phone, email" className="min-h-11 rounded-xl border bg-card px-3 text-sm"/><select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="min-h-11 rounded-xl border bg-card px-3 text-sm"><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></select></div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">Could not load vendors. Run profile_admin_setup.sql and try again.</p>}
    <div className="overflow-x-auto rounded-2xl border bg-card"><table className="w-full min-w-[960px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-muted-foreground"><th className="p-3">Vendor</th><th className="p-3">Business</th><th className="p-3">Phone</th><th className="p-3">Email</th><th className="p-3">Verified</th><th className="p-3">Status</th><th className="p-3">Registered</th><th className="p-3">Actions</th></tr></thead>
      <tbody>{isLoading ? <tr><td colSpan={8} className="p-6 text-center">Loading vendors…</td></tr> : visible.length === 0 ? <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No vendors found.</td></tr> : visible.map((row) => <tr key={row.user_id} className="border-b last:border-0"><td className="p-3 font-semibold">{row.full_name || "—"}</td><td className="p-3">{row.business_name || "—"}</td><td className="p-3">{row.phone || "—"}</td><td className="p-3">{row.email}</td><td className="p-3">{row.email_verified ? "Yes" : "No"}</td><td className="p-3 capitalize">{row.approval_status}</td><td className="p-3">{new Date(row.created_at).toLocaleDateString()}</td><td className="p-3"><div className="flex flex-wrap gap-1">{row.approval_status === "pending" && <><Button size="sm" disabled={action.isPending || !row.email_verified} title={!row.email_verified ? "Email must be verified first" : undefined} onClick={() => run(row,"approve_vendor")}>Approve</Button><Button size="sm" variant="outline" disabled={action.isPending} onClick={() => run(row,"reject_vendor")}>Reject</Button></>}{row.approval_status === "approved" && <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => run(row,"suspend_vendor")}>Suspend</Button>}{(row.approval_status === "suspended" || row.approval_status === "rejected") && <Button size="sm" disabled={action.isPending} onClick={() => run(row,"reinstate_vendor")}>Reinstate</Button>}</div></td></tr>)}</tbody></table></div>
    <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{filtered.length} vendors · Page {page + 1} of {count}</p><div className="flex gap-2"><Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button variant="outline" disabled={page + 1 >= count} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>
  </section>;
}
