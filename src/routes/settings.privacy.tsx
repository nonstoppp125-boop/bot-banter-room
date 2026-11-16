import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/settings/privacy")({
  head: () => ({ meta: [{ title: "Privacy & Data — Liza" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: PrivacySettingsPage,
});

type PendingDeletion = {
  id: string; userId: string; status: string; requestedAt: string; scheduledFor: string;
};

function PrivacySettingsPage() {
  const [pending, setPending] = useState<PendingDeletion | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/account/deletion", { credentials: "same-origin", headers: { Accept: "application/json" } });
      const data = await response.json() as { pending?: PendingDeletion | null; error?: string };
      if (!response.ok) throw new Error(data.error || "Privacy settings could not be loaded.");
      setPending(data.pending ?? null); setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Privacy settings could not be loaded.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const requestDeletion = async () => {
    const phrase = window.prompt('To schedule account deletion after the 30-day grace period, type exactly: DELETE MY ACCOUNT');
    if (phrase !== "DELETE MY ACCOUNT") return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/account/deletion", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ operation: "request", confirmationPhrase: phrase }),
      });
      const data = await response.json() as { id?: string; scheduledFor?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Deletion request could not be scheduled.");
      setNotice("Deletion request recorded. It is not immediate; the grace period ends " + new Date(data.scheduledFor || "").toLocaleString() + ".");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Deletion request could not be scheduled.");
    } finally { setBusy(false); }
  };

  const cancelDeletion = async () => {
    if (!pending || !window.confirm("Cancel the pending account deletion request?")) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/account/deletion", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ operation: "cancel", id: pending.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Deletion request could not be cancelled.");
      setNotice("Pending deletion request cancelled.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Deletion request could not be cancelled.");
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to chat</a>
        <header className="mb-8 mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Account settings</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Privacy & data</h1>
          <p className="mt-2 text-sm text-muted-foreground">Export your data or schedule account deletion. Credentials and provider tokens are excluded from exports.</p>
        </header>
        {error && <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{error} <a href="/api/auth/session" className="underline">Sign in</a></p>}
        {notice && <p role="status" className="mb-4 rounded-xl border border-border bg-muted p-3 text-sm">{notice}</p>}
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">Export my data</h2>
          <p className="mt-2 text-sm text-muted-foreground">Download the records associated with your account. The export redacts secrets and excludes encrypted provider credentials.</p>
          <a href="/api/account/export" className="mt-4 inline-flex rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Download JSON export</a>
        </section>
        <section className="mt-5 rounded-xl border border-destructive/30 bg-card p-4">
          <h2 className="font-semibold">Delete my account</h2>
          <p className="mt-2 text-sm text-muted-foreground">Deletion requests have a 30-day grace period. This screen schedules or cancels the request; it does not immediately erase data. A background deletion worker and final execution are not enabled yet.</p>
          {loading ? <p className="mt-4 text-sm text-muted-foreground">Checking request status…</p> :
            pending ? <div className="mt-4 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Deletion scheduled</p>
              <p className="mt-1 text-xs text-muted-foreground">Requested: {new Date(pending.requestedAt).toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">Grace period ends: {new Date(pending.scheduledFor).toLocaleString()}</p>
              <button onClick={() => void cancelDeletion()} disabled={busy} className="mt-3 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50">{busy ? "Working…" : "Cancel deletion request"}</button>
            </div> :
            <button onClick={() => void requestDeletion()} disabled={busy} className="mt-4 rounded-lg border border-destructive/50 px-4 py-2 text-sm text-destructive hover:bg-destructive/5 disabled:opacity-50">{busy ? "Working…" : "Schedule account deletion"}</button>}
        </section>
      </div>
    </main>
  );
}
