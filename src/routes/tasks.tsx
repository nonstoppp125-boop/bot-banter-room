import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

export const Route = createFileRoute("/tasks")({
  head: () => ({ meta: [{ title: "Manager Tasks — Liza" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: TasksPage,
});

type Task = {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "needs_approval";
  inputSummary: string;
  createdAt: string;
  updatedAt: string;
  result?: { output?: string; error?: string } | null;
};

const statusLabels: Record<Task["status"], string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  needs_approval: "Needs approval",
};

function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskText, setTaskText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tasks", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const data = await response.json() as { tasks?: Task[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Tasks could not be loaded.");
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tasks could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const task = taskText.trim();
    if (!task || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ task }),
      });
      const data = await response.json() as { task?: Task; error?: string };
      if (!response.ok) throw new Error(data.error || "Task could not be submitted.");
      setTaskText("");
      setNotice(data.task?.status === "needs_approval"
        ? "Task saved and is waiting for approval."
        : "Task plan saved to the durable queue. Background execution is not enabled yet.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Task could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  };

  const execute = async (taskId: string) => {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/tasks/execute", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await response.json() as { error?: string; detail?: string; task?: { status?: string } };
      if (!response.ok) throw new Error(data.detail || data.error || "Task execution failed.");
      setNotice("Manager specialists completed the task and saved the result.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Task execution failed.");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (taskId: string) => {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "cancel", taskId }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Task could not be cancelled.");
      setNotice("Queued task cancelled.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Task could not be cancelled.");
    } finally {
      setSubmitting(false);
    }
  };

  const retry = async (taskId: string) => {
    setSubmitting(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "retry", taskId }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Task could not be requeued.");
      setNotice("Failed task requeued. Run with Manager to retry it; automatic background retries are not enabled.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Task could not be requeued.");
    } finally { setSubmitting(false); }
  };

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to chat</a>
        <header className="mb-8 mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Manager workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Durable tasks</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Submit a bounded task to Manager planning and review its saved status.</p>
        </header>
        <div className="mb-5 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <strong>Execution status:</strong> Low-risk queued tasks can be run on demand through the Manager specialist workflow. This is a synchronous user-triggered Worker request, not an always-on background queue. High-risk tasks remain blocked until human approval.
        </div>
        {error && <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-xl border border-border bg-muted p-3 text-sm">{notice}</p>}
        <form onSubmit={submit} className="mb-8 rounded-xl border border-border bg-card p-4">
          <label htmlFor="manager-task" className="block text-sm font-medium">New task</label>
          <textarea id="manager-task" value={taskText} onChange={(event) => setTaskText(event.target.value)} maxLength={20000} required rows={4} placeholder="Describe the outcome you want Manager to plan…" className="mt-2 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{taskText.length.toLocaleString()} / 20,000</span>
            <button type="submit" disabled={submitting || !taskText.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">{submitting ? "Saving…" : "Create task plan"}</button>
          </div>
        </form>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your recent tasks</h2>
          <button onClick={() => void load()} disabled={loading} className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent disabled:opacity-50">{loading ? "Loading…" : "Refresh"}</button>
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading tasks…</p> :
          tasks.length === 0 ? <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">No tasks have been saved yet.</p> :
          <div className="space-y-3">
            {tasks.map((task) => (
              <article key={task.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">{task.inputSummary}</p>
                  <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{statusLabels[task.status] || task.status}</span>
                </div>
                {task.result?.output && <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/60 p-3 text-sm">{task.result.output}</pre>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Created {new Date(task.createdAt).toLocaleString()}</p>
                  <div className="flex flex-wrap gap-2">
                    {task.status === "queued" && <button type="button" onClick={() => void execute(task.id)} disabled={submitting} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">{submitting ? "Running…" : "Run with Manager"}</button>}
                    {task.status === "failed" && <button type="button" onClick={() => void retry(task.id)} disabled={submitting} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50">Retry (max 2)</button>}
                    {task.status === "queued" && <button type="button" onClick={() => void cancel(task.id)} disabled={submitting} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50">Cancel queued task</button>}
                  </div>
                </div>
              </article>
            ))}
          </div>}
      </div>
    </main>
  );
}
