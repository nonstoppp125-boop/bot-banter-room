import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { Send, SquarePen } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
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
      { title: "Doot — AI চ্যাট" },
      { name: "description", content: "ChatGPT-এর মতো AI চ্যাট, বাংলা ও ইংরেজিতে।" },
      { property: "og:title", content: "Doot — AI চ্যাট" },
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

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
            <Send className="size-4 -rotate-12" />
          </div>
          <span className="font-display text-lg font-semibold">Doot</span>
        </div>
        <button
          onClick={() => setMessages([])}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          <SquarePen className="size-4" /> নতুন চ্যাট
        </button>
      </header>

      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="আজ কীভাবে সাহায্য করতে পারি?"
              description="যেকোনো প্রশ্ন বাংলা বা ইংরেজিতে লিখুন"
              icon={<Send className="size-10 -rotate-12 text-primary" />}
            >
              <Send className="size-10 -rotate-12 text-primary" />
              <h2 className="font-display text-2xl font-semibold">আজ কীভাবে সাহায্য করতে পারি?</h2>
              <p className="text-sm text-muted-foreground">যেকোনো প্রশ্ন বাংলা বা ইংরেজিতে লিখুন</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-border px-4 py-2 text-sm hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => (
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
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && <Shimmer>ভাবছি...</Shimmer>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <PromptInput onSubmit={(msg) => send(msg.text)}>
          <PromptInputTextarea autoFocus placeholder="মেসেজ লিখুন..." />
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-center text-xs text-muted-foreground">Doot ভুল করতে পারে। গুরুত্বপূর্ণ তথ্য যাচাই করুন।</p>
      </div>
    </div>
  );
}
