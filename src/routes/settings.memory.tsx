import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/settings/memory")({
  head: () => ({ meta: [{ title: "Memory — Liza" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: MemorySettingsPage,
});

type Memory = {
  id: string; category: "preference" | "project" | "workflow" | "other";
  content: string; createdAt: string; updatedAt: string; expiresAt: string | null;
};
const categories: Memory["category"][] = ["preference", "project", "workflow", "other"];

function MemorySettingsPage() {
  const [items, setItems] = useState<Memory[]>([]);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Memory["category"]>("preference");
  const [editing, setEditing] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/memories", { credentials: "same-origin", headers: { Accept: "application/json" } });
      const data = await response.json() as { memories?: Memory[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Memory could not be loaded.");
      setItems(Array.isArray(data.memories) ? data.memories : []);
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Memory could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!content.trim()) { setError("Memory content is required."); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/memories", {
        method: editing ? "PATCH" : "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(editing
          ? { id: editing.id, expectedUpdatedAt: editing.updatedAt, category, content: content.trim() }
          : { category, content: content.trim() }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Memory could not be saved.");
      setContent(""); setEditing(null); setNotice(editing ? "Memory updated." : "Memory saved.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Memory could not be saved."); }
    finally { setBusy(false); }
  };

  const remove = async (item: Memory) => {
    if (!window.confirm("Delete this memory? It will no longer be used in memory searches.")) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/memories", {
        method: "DELETE", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Memory could not be deleted.");
      if (editing?.id === item.id) { setEditing(null); setContent(""); }
      setNotice("Memory deleted."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Memory could not be deleted."); }
    finally { setBusy(false); }
  };

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to chat</a>
        <header className="mb-8 mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Personalization</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Memory</h1>
          <p className="mt-2 text-sm text-muted-foreground">Add, edit or delete details you explicitly want retained. Do not save passwords, API keys, tokens or other secrets. Memories are scoped to your account and workspace.</p>
        </header>
        {error && <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-xl border border-border bg-muted p-3 text-sm">{notice}</p>}
        <section className="mb-6 rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">{editing ? "Edit memory" : "Add a memory"}</h2>
          <label className="mt-4 block text-sm font-medium" htmlFor="memory-category">Category</label>
          <select id="memory-category" value={category} onChange={(event) => setCategory(event.target.value as Memory["category"])} className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm">
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <label className="mt-4 block text-sm font-medium" htmlFor="memory-content">What should be remembered?</label>
          <textarea id="memory-content" value={content} onChange={(event) => setContent(event.target.value)} maxLength={4000} rows={4} className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm" placeholder="Write a preference, project detail or workflow…" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => void save()} disabled={busy || !content.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? "Saving…" : editing ? "Save changes" : "Add memory"}</button>
            {editing && <button onClick={() => { setEditing(null); setContent(""); }} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel edit</button>}
          </div>
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Saved memories</h2><button onClick={() => void load()} disabled={loading} className="rounded-lg border border-border px-3 py-2 text-xs">{loading ? "Loading…" : "Refresh"}</button></div>
          {loading ? <p className="text-sm text-muted-foreground">Loading memories…</p> :
            items.length === 0 ? <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">No saved memories yet.</p> :
            <div className="space-y-3">{items.map((item) => (
              <article key={item.id} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between gap-3"><span className="rounded-full bg-muted px-2 py-1 text-xs">{item.category}</span><span className="text-xs text-muted-foreground">Updated {new Date(item.updatedAt).toLocaleDateString()}</span></div>
                <p className="whitespace-pre-wrap break-words text-sm">{item.content}</p>
                <div className="mt-3 flex gap-3 text-sm"><button disabled={busy} onClick={() => { setEditing(item); setContent(item.content); setCategory(item.category); }} className="underline">Edit</button><button disabled={busy} onClick={() => void remove(item)} className="text-destructive underline">Delete</button></div>
              </article>
            ))}</div>}
        </section>
      </div>
    </main>
  );
}
