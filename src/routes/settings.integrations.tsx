import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/settings/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Liza" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: IntegrationsPage,
});

type Connection = { id: string; provider: string; scopes: string[]; tokenExpiresAt: string | null; createdAt: string; updatedAt: string };
type Provider = { id: string; name: string; enabled: boolean; note: string };

const providers: Provider[] = [
  { id: "instagram", name: "Instagram", enabled: true, note: "Instagram Business account and approved Meta app required." },
  { id: "facebook", name: "Facebook Pages", enabled: true, note: "Meta app review and Page permissions required." },
  { id: "youtube", name: "YouTube", enabled: true, note: "Google OAuth consent and YouTube API access required." },
  { id: "x", name: "X", enabled: true, note: "X developer app and approved OAuth scopes required." },
  { id: "linkedin", name: "LinkedIn", enabled: false, note: "Provider scope approval is not yet verified." },
  { id: "tiktok", name: "TikTok", enabled: false, note: "Developer product approval is required." },
  { id: "github", name: "GitHub", enabled: false, note: "Repository-specific least-privilege scopes are not configured." },
  { id: "google-drive", name: "Google Drive", enabled: false, note: "Drive scopes are not configured." },
  { id: "gmail", name: "Gmail", enabled: false, note: "Restricted/sensitive scopes require verification." },
  { id: "google-calendar", name: "Google Calendar", enabled: false, note: "Calendar scopes are not configured." },
  { id: "slack", name: "Slack", enabled: false, note: "Workspace-specific scopes are not configured." },
  { id: "discord", name: "Discord", enabled: false, note: "Guild scopes are not configured." },
  { id: "notion", name: "Notion", enabled: false, note: "Workspace access scopes are not configured." },
];

function IntegrationsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/integrations", { credentials: "same-origin", headers: { Accept: "application/json" } });
      const data = await response.json() as { connections?: Connection[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load integrations.");
      setConnections(Array.isArray(data.connections) ? data.connections : []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load integrations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const connected = url.searchParams.get("connected");
    if (connected) {
      setNotice(connected + " connection saved securely.");
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.toString());
      void load();
    }
  }, [load]);

  const connect = async (provider: Provider) => {
    setBusy(provider.id); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/integrations/oauth/start", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ provider: provider.id }),
      });
      const data = await response.json() as { authorizationUrl?: string; error?: string };
      if (!response.ok || !data.authorizationUrl) throw new Error(data.error || "OAuth could not be started.");
      const destination = new URL(data.authorizationUrl);
      if (destination.protocol !== "https:") throw new Error("Provider authorization URL was rejected.");
      window.location.assign(destination.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connection could not be started.");
      setBusy(null);
    }
  };

  const refreshConnection = async (connection: Connection) => {
    setBusy(connection.id); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/integrations/refresh", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ connectionId: connection.id }),
      });
      const data = await response.json() as { error?: string; refreshed?: boolean };
      if (!response.ok) throw new Error(data.error || "Token refresh failed.");
      setNotice("Provider credentials refreshed and encrypted.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Token refresh failed.");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (connection: Connection) => {
    if (!window.confirm("Disconnect " + connection.provider + "? Local credentials will be cleared.")) return;
    setBusy(connection.id); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/integrations/disconnect", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ connectionId: connection.id }),
      });
      const data = await response.json() as { error?: string; note?: string };
      if (!response.ok) throw new Error(data.error || "Disconnect failed.");
      setNotice(data.note || "Connection disconnected.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Disconnect failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to chat</a>
        <header className="mb-8 mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace settings</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Integrations</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Connect external accounts with least-privilege permissions. Credentials are stored encrypted and are never displayed here.</p>
        </header>
        {error && <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-xl border border-border bg-muted p-3 text-sm">{notice}</p>}
        <section aria-labelledby="connected-title" className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="connected-title" className="text-lg font-semibold">Connected accounts</h2>
            <button onClick={() => void load()} disabled={loading} className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent disabled:opacity-50">{loading ? "Loading…" : "Refresh"}</button>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">Loading connections…</p> :
            connections.length === 0 ? <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">No connected accounts yet.</p> :
            <div className="divide-y divide-border rounded-xl border border-border">
              {connections.map((connection) => (
                <div key={connection.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div><p className="font-medium">{providers.find((provider) => provider.id === connection.provider)?.name || connection.provider}</p><p className="mt-1 text-xs text-muted-foreground">{connection.scopes.join(" · ")}</p><p className="mt-1 text-[11px] text-muted-foreground">{connection.tokenExpiresAt ? "Token expires: " + new Date(connection.tokenExpiresAt).toLocaleString() : "Token expiry not reported"}</p></div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => void refreshConnection(connection)} disabled={busy !== null} className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent disabled:opacity-50">{busy === connection.id ? "Working…" : "Refresh token"}</button>
                    <button onClick={() => void disconnect(connection)} disabled={busy !== null} className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent disabled:opacity-50">{busy === connection.id ? "Working…" : "Disconnect"}</button>
                  </div>
                </div>
              ))}
            </div>}
        </section>
        <section aria-labelledby="available-title">
          <h2 id="available-title" className="mb-3 text-lg font-semibold">Available providers</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((provider) => (
              <article key={provider.id} className="flex min-h-32 flex-col justify-between rounded-xl border border-border bg-card p-4">
                <div><div className="flex items-center justify-between gap-2"><h3 className="font-medium">{provider.name}</h3><span className="text-[11px] text-muted-foreground">{provider.enabled ? "OAuth available" : "Not configured"}</span></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{provider.note}</p></div>
                <button onClick={() => void connect(provider)} disabled={!provider.enabled || busy !== null} className="mt-4 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{busy === provider.id ? "Connecting…" : provider.enabled ? "Connect" : "Unavailable"}</button>
              </article>
            ))}
          </div>
        </section>
        <p className="mt-8 text-xs text-muted-foreground">Refresh is user-triggered; automatic background refresh is not enabled. Disconnect clears local encrypted credentials. If the provider supports remote revocation, also revoke this app from that provider’s security settings.</p>
      </div>
    </main>
  );
}
