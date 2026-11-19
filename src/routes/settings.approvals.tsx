import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/settings/approvals")({
  head: () => ({ meta: [{ title: "Approvals — Liza" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ApprovalInboxPage,
});

type Approval = {
  id: string; workspaceId: string; userId: string; actionType: string; payloadHash: string;
  summary: string; status: string; expiresAt: string; createdAt: string;
};

function ApprovalInboxPage() {
  const [items, setItems] = useState<Approval[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/approvals", { credentials: "same-origin", headers: { Accept: "application/json" } });
      const data = await response.json() as { approvals?: Approval[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Approval inbox could not be loaded.");
      setItems(Array.isArray(data.approvals) ? data.approvals : []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Approval inbox could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (item: Approval, decision: "approved" | "rejected") => {
    const reason = (reasons[item.id] || "").trim();
    if (!reason) { setError("প্রতিটি সিদ্ধান্তের জন্য কারণ লিখতে হবে।"); return; }
    setBusy(item.id); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/approvals", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ approvalId: item.id, decision, reason }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Approval decision could not be saved.");
      setNotice(decision === "approved" ? "Approval recorded." : "Request rejected.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Approval decision could not be saved.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to chat</a>
        <header className="mb-8 mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace security</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Approval inbox</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Review requests from this workspace. Every decision is recorded against the request, workspace and reviewer identity.</p>
        </header>
        <div className="mb-5 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <strong>Important:</strong> Approving a request records authorization only. It does not publish, send messages, deploy, delete data or execute an external action.
        </div>
        {error && <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-xl border border-border bg-muted p-3 text-sm">{notice}</p>}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pending requests</h2>
          <button onClick={() => void load()} disabled={loading} className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent disabled:opacity-50">{loading ? "Loading…" : "Refresh"}</button>
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading approvals…</p> :
          items.length === 0 ? <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">No pending approval requests.</p> :
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-semibold">{item.actionType}</p><p className="mt-1 text-sm">{item.summary}</p></div>
                  <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">Pending</span>
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <div><dt className="inline">Requester: </dt><dd className="inline break-all">{item.userId}</dd></div>
                  <div><dt className="inline">Expires: </dt><dd className="inline">{new Date(item.expiresAt).toLocaleString()}</dd></div>
                  <div className="sm:col-span-2"><dt className="inline">Payload SHA-256: </dt><dd className="inline break-all font-mono">{item.payloadHash}</dd></div>
                </dl>
                <label className="mt-4 block text-xs font-medium" htmlFor={"reason-" + item.id}>Decision reason</label>
                <textarea id={"reason-" + item.id} value={reasons[item.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={1000} rows={2} placeholder="Why is this request approved or rejected?" className="mt-2 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button onClick={() => void decide(item, "rejected")} disabled={busy !== null} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50">{busy === item.id ? "Saving…" : "Reject"}</button>
                  <button onClick={() => void decide(item, "approved")} disabled={busy !== null} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">{busy === item.id ? "Saving…" : "Approve"}</button>
                </div>
              </article>
            ))}
          </div>}
      </div>
    </main>
  );
}
