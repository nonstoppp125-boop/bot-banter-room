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
type DevPilotApproval = {
  id: string; userId: string; taskId: string; repository: string;
  summary: string; status: "pending" | "approved"; expiresAt: string; createdAt: string;
  proposalFiles: Array<{ path: string; beforeSha: string | null; beforeContent: string | null; content: string }>;
};

function ApprovalInboxPage() {
  const [items, setItems] = useState<Approval[]>([]);
  const [devPilotItems, setDevPilotItems] = useState<DevPilotApproval[]>([]);
  const [devPilotReasons, setDevPilotReasons] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [response, devPilotResponse] = await Promise.all([
        fetch("/api/approvals", { credentials: "same-origin", headers: { Accept: "application/json" } }),
        fetch("/api/devpilot/approvals", { credentials: "same-origin", headers: { Accept: "application/json" } }),
      ]);
      const [data, devPilotData] = await Promise.all([
        response.json() as Promise<{ approvals?: Approval[]; error?: string }>,
        devPilotResponse.json() as Promise<{ approvals?: DevPilotApproval[]; error?: string }>,
      ]);
      if (!response.ok) throw new Error(data.error || "Approval inbox could not be loaded.");
      if (!devPilotResponse.ok) throw new Error(devPilotData.error || "DevPilot approvals could not be loaded.");
      setItems(Array.isArray(data.approvals) ? data.approvals : []);
      setDevPilotItems(Array.isArray(devPilotData.approvals) ? devPilotData.approvals : []);
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

  const decideDevPilot = async (item: DevPilotApproval, decision: "approved" | "rejected") => {
    const reason = (devPilotReasons[item.id] || "").trim();
    if (!reason) { setError("প্রতিটি DevPilot সিদ্ধান্তের জন্য কারণ লিখতে হবে।"); return; }
    setBusy(item.id); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/devpilot/approvals", {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ approvalId: item.id, decision, reason }),
      });
      const data = await response.json() as { error?: string; runUpdated?: boolean; recovered?: boolean };
      if (!response.ok) throw new Error(data.error || "DevPilot approval decision could not be saved.");
      setNotice(decision === "approved"
        ? (data.recovered
          ? (data.runUpdated ? "Approval was already recorded; the DevPilot run has now been re-queued." : "Approval is already recorded; the run is still waiting for recovery.")
          : (data.runUpdated ? "DevPilot approval recorded; the run is queued for a worker." : "DevPilot approval recorded; no active run was resumed."))
        : "DevPilot proposal rejected.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "DevPilot approval decision could not be saved.");
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
                  <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{item.status === "approved" ? "Approved — resume pending" : "Pending"}</span>
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
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">DevPilot code-change approvals</h2>
            <span className="text-xs text-muted-foreground">{devPilotItems.length} pending</span>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">These approvals are bound to a workspace, repository, task and exact proposal hash. Approval authorizes only that proposal; it does not merge or deploy code.</p>
          {loading ? <p className="text-sm text-muted-foreground">Loading DevPilot approvals…</p> :
            devPilotItems.length === 0 ? <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">No pending DevPilot code-change approvals.</p> :
            <div className="space-y-3">
              {devPilotItems.map((item) => (
                <article key={item.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><p className="font-semibold">{item.repository}</p><p className="mt-1 text-sm">{item.summary}</p></div>
                    <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">Pending</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div><dt className="inline">Requester: </dt><dd className="inline break-all">{item.userId}</dd></div>
                    <div><dt className="inline">Task ID: </dt><dd className="inline break-all font-mono">{item.taskId}</dd></div>
                    <div><dt className="inline">Expires: </dt><dd className="inline">{new Date(item.expiresAt).toLocaleString()}</dd></div>
                  </dl>
                  <details className="mt-4 rounded-lg border border-border">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Review proposed code ({item.proposalFiles.length} files)</summary>
                    <div className="space-y-3 border-t border-border p-3">
                      {item.proposalFiles.length === 0
                        ? <p className="text-sm text-destructive">No reviewable proposal content is attached. This request must not be approved.</p>
                        : item.proposalFiles.map((file) => (
                          <div key={file.path}>
                            <p className="mb-1 break-all text-xs font-semibold">{file.path}</p>
                            <p className="mb-2 break-all text-[11px] text-muted-foreground">Base SHA: {file.beforeSha || "New file"}</p>
                            {file.beforeContent !== null && <><p className="mb-1 text-[11px] font-semibold text-muted-foreground">Current content</p><pre className="mb-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">{file.beforeContent}</pre></>}
                            <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Proposed content</p>
                            <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">{file.content}</pre>
                          </div>
                        ))}
                    </div>
                  </details>
                  <label className="mt-4 block text-xs font-medium" htmlFor={"devpilot-reason-" + item.id}>{item.status === "approved" ? "Recovery note" : "Decision reason"}</label>
                  <textarea id={"devpilot-reason-" + item.id} value={devPilotReasons[item.id] || ""} onChange={(event) => setDevPilotReasons((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={1000} rows={2} placeholder="Why is this exact code proposal approved or rejected?" className="mt-2 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button onClick={() => void decideDevPilot(item, "rejected")} disabled={busy !== null || item.status === "approved"} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50">{busy === item.id ? "Saving…" : "Reject"}</button>
                    <button onClick={() => void decideDevPilot(item, "approved")} disabled={busy !== null || item.proposalFiles.length === 0} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">{busy === item.id ? "Saving…" : item.status === "approved" ? "Retry resume" : "Approve"}</button>
                  </div>
                </article>
              ))}
            </div>}
        </section>
      </div>
    </main>
  );
}
