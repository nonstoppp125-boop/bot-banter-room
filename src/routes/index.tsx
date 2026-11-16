import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { SquarePen } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Liza — AI চ্যাট" },
      { name: "description", content: "ChatGPT-এর মতো AI চ্যাট, বাংলা ও ইংরেজিতে।" },
      { property: "og:title", content: "Liza — AI চ্যাট" },
      { property: "og:description", content: "ChatGPT-এর মতো AI চ্যাট, বাংলা ও ইংরেজিতে।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const suggestions = ["আমাকে একটা গল্প বলো", "Telegram বট কীভাবে বানাই?", "আজকের জন্য একটা রেসিপি দাও"];

function Index() {
  const [error, setError] = useState<string | null>(null);
  const [taskSaving, setTaskSaving] = useState<string | null>(null);
  const [taskNotice, setTaskNotice] = useState<string | null>(null);
  const [taskNoticeFor, setTaskNoticeFor] = useState<string | null>(null);
  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (e) => setError(e.message || "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।"),
  });
  const busy = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setError(null);
    sendMessage({ text });
  };

  const saveMessageAsTask = async (messageId: string, taskText: string) => {
    if (!taskText.trim() || taskSaving) return;
    setTaskSaving(messageId);
    setTaskNotice(null);
    setTaskNoticeFor(null);
    setError(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ task: taskText }),
      });
      const data = await response.json() as { task?: { status?: string }; error?: string };
      if (!response.ok) throw new Error(data.error || "Manager task could not be saved.");
      setTaskNoticeFor(messageId);
      setTaskNotice(data.task?.status === "needs_approval"
        ? "Manager plan saved — approval required."
        : "Manager plan saved. Open Tasks and choose Run with Manager for on-demand execution; automatic background execution is not enabled.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Manager task could not be saved.");
    } finally {
      setTaskSaving(null);
    }
  };

  const composer = (
    <PromptInput className="composer" onSubmit={(msg) => send(msg.text)}>
      <PromptInputTextarea autoFocus placeholder="যেকোনো কিছু জিজ্ঞেস করুন" aria-label="বার্তা লিখুন" className="min-h-12 px-5 pt-4 text-[15px]" />
      <PromptInputFooter className="px-3 pb-3">
        <PromptInputTools />
        <PromptInputSubmit status={status} onStop={stop} className="rounded-full" />
      </PromptInputFooter>
    </PromptInput>
  );
  const empty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-background font-sans">
      <a href="#main-content" className="sr-only z-50 rounded-md bg-background p-3 text-foreground focus:not-sr-only focus:absolute focus:left-3 focus:top-3">মূল কনটেন্টে যান</a>
      <header className="flex items-center justify-between px-3 py-2">
        <span className="rounded-lg px-2 py-1.5 font-display text-lg font-medium">Liza</span>
        <nav aria-label="প্রধান নেভিগেশন" className="flex items-center gap-1"><a href="/tasks" className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">Tasks</a><a href="/analytics" className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">Analytics</a><a href="/api/auth/session" className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">Sign in</a><a href="/settings/integrations" className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">Integrations</a><a href="/settings/approvals" className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">Approvals</a><a href="/settings/privacy" className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">Privacy</a><button onClick={() => { void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).then((response) => { if (response.ok) window.location.reload(); else setError("Sign out failed."); }).catch(() => setError("Sign out failed.")); }} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">Sign out</button></nav>
        <button
          onClick={() => setMessages([])}
          aria-label="নতুন চ্যাট"
          className="grid size-9 place-items-center rounded-lg text-foreground hover:bg-accent"
        >
          <SquarePen className="size-5" />
        </button>
      </header>

      {empty ? (
        <main id="main-content" className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
          <h1 className="mb-8 text-center font-display text-2xl font-medium sm:text-3xl">
            আজ কীভাবে সাহায্য করতে পারি?
          </h1>
          <div className="w-full max-w-3xl">{composer}</div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent"
              >
                {s}
              </button>
            ))}
          </div>
        </main>
      ) : (
        <main id="main-content" className="flex min-h-0 flex-1 flex-col">
          <Conversation className="flex-1">
            <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6">
              {messages.map((m) => (
                <Message from={m.role} key={m.id}>
                  <MessageContent>
                    {m.parts.map((p, i) =>
                      p.type === "text" ? (
                        m.role === "assistant" ? (
                          <MessageResponse key={i}>{p.text}</MessageResponse>
                        ) : (
                          <span key={i} className="whitespace-pre-wrap">{p.text}</span>
                        )
                      ) : null,
                    )}
                    {m.role === "user" && m.parts.some((part) => part.type === "text" && part.text.trim()) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void saveMessageAsTask(m.id, m.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n"))}
                          disabled={taskSaving !== null}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
                        >
                          {taskSaving === m.id ? "Saving plan…" : "Create Manager task"}
                        </button>
                        {taskNotice && taskNoticeFor === m.id && taskSaving === null && <span role="status" className="text-xs text-muted-foreground">{taskNotice}</span>}
                      </div>
                    )}
                  </MessageContent>
                </Message>
              ))}
              {status === "submitted" && <Shimmer>ভাবছি...</Shimmer>}
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
          <div className="safe-area-bottom mx-auto w-full max-w-3xl px-4 pb-3">
            {composer}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Liza ভুল করতে পারে। গুরুত্বপূর্ণ তথ্য যাচাই করুন।
            </p>
          </div>
        </main>
      )}
    </div>
  );
}
