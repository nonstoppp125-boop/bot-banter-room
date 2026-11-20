import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

export const Route = createFileRoute("/devpilot" as any)({
  head: () => ({ meta: [{ title: "DevPilot — Liza" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: DevPilotPage,
});

type DevPilotRun = {
  id: string;
  task: string;
  repository: string;
  baseBranch: string;
  status: "queued" | "running" | "awaiting_approval" | "completed" | "blocked" | "failed" | "cancelled";
  progress: number;
  workerAttemptCount: number;
  createdAt: string;
  updatedAt: string;
  checkpoint?: { stage?: string; data?: { reason?: string; pullRequest?: { number?: number; url?: string } } };
};

const labels: Record<DevPilotRun["status"], string> = {
  queued: "Queued", running: "Running", awaiting_approval: "Awaiting approval",
  completed: "Completed", blocked: "Blocked", failed: "Failed", cancelled: "Cancelled",
};

function DevPilotPage() {
  const [runs, setRuns] = useState<DevPilotRun[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [task, setTask] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/devpilot/runs", {
        credentials: "same-origin", headers: { Accept: "application/json" },
      });
      const data = await response.json() as { runs?: DevPilotRun[]; enabled?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "DevPilot runs could not be loaded.");
      setRuns(Array.isArray(data.runs) ? data.runs : []);
      setEnabled(data.enabled === true);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "DevPilot runs could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!task.trim() || submitting || !enabled) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/devpilot/runs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          task: task.trim(), repository: "nonstoppp125-boop/bot-banter-room", baseBranch: baseBranch.trim(),
        }),
      });
      const data = await response.json() as { run?: DevPilotRun; error?: string };
      if (!response.ok) throw new Error(data.error || "DevPilot task could not be queued.");
      setTask("");
      setNotice("Task added to the durable DevPilot queue. The Worker will process one repository task at a time.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "DevPilot task could not be queued.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Autonomous coding workforce</p>
        <h1 className="text-3xl font-semibold tracking-tight">DevPilot</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Submit a repository task once. DevPilot plans, proposes code, validates it in an isolated GitHub Actions runner,
          and opens a draft pull request. It never merges or deploys.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">New coding task</h2>
          <span className={enabled
            ? "rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
            : "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"}>
            {enabled ? "Runtime enabled" : "Runtime disabled"}
          </span>
        </div>
        {!enabled && (
          <p className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Task execution is disabled until the GitHub token, repository allowlist, Groq key and explicit Worker opt-in are configured.
            You can still review existing runs below.
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">What should DevPilot build or fix?</span>
            <textarea
              value={task}
              onChange={(event) => setTask(event.target.value)}
              maxLength={4000}
              rows={5}
              required
              disabled={!enabled || submitting}
              placeholder="Example: Find and fix the failing task queue tests. Add regression coverage and open a draft PR."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            />
            <span className="text-xs text-muted-foreground">{task.length}/4000 characters</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Repository allowlist</span>
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">nonstoppp125-boop/bot-banter-room</p>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Base branch</span>
              <input
                value={baseBranch}
                onChange={(event) => setBaseBranch(event.target.value)}
                maxLength={120}
                disabled={!enabled || submitting}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!enabled || submitting || !task.trim() || !baseBranch.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? "Submitting…" : "Queue DevPilot task"}
            </button>
            <button type="button" onClick={() => void load()} disabled={loading || submitting}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50">
              Refresh runs
            </button>
          </div>
        </form>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Run history</h2>
          <span className="text-xs text-muted-foreground">{runs.length} recent runs</span>
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading runs…</p> :
          runs.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">No DevPilot runs yet.</p> :
          <div className="space-y-3">
            {runs.map((run) => (
              <article key={run.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{run.task}</p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{run.repository} · {run.baseBranch} · {run.id}</p>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{labels[run.status]}</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: run.progress + "%" }} />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{run.progress}%</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Stage: {run.checkpoint?.stage ?? "queued"}</span>
                  <span>Attempts: {run.workerAttemptCount}/2</span>
                  <span>Updated: {new Date(run.updatedAt).toLocaleString()}</span>
                </div>
                {run.checkpoint?.data?.reason && <p className="mt-2 text-sm text-muted-foreground">{run.checkpoint.data.reason}</p>}
                {run.checkpoint?.data?.pullRequest?.url && (
                  <a className="mt-3 inline-block text-sm font-medium text-primary underline" href={run.checkpoint.data.pullRequest.url} target="_blank" rel="noreferrer">
                    Draft PR #{run.checkpoint.data.pullRequest.number}
                  </a>
                )}
              </article>
            ))}
          </div>
        }
      </section>

      <p className="text-xs text-muted-foreground">
        High-risk work waits for a hash-bound administrator approval in Settings → Approvals. DevPilot creates draft PRs only; it cannot merge, deploy, publish, or change production settings.
      </p>
    </main>
  );
}
