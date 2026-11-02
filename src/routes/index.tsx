import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useState } from "react";
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

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Doot — AI Assistant" },
      { name: "description", content: "Doot — বাংলা ও ইংরেজিতে AI assistant।" },
      { property: "og:title", content: "Doot — AI Assistant" },
      { property: "og:description", content: "Doot — বাংলা ও ইংরেজিতে AI assistant।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const suggestions = ["আমাকে একটা গল্প বলো", "Telegram বট কীভাবে বানাই?", "আজকের জন্য একটা রেসিপি দাও"];

function Index() {
  const [error, setError] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };
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

  const composer = (
    <PromptInput className="composer" onSubmit={(msg) => send(msg.text)}>
      <PromptInputTextarea autoFocus placeholder="যেকোনো কিছু জিজ্ঞেস করুন" className="min-h-12 px-5 pt-4 text-[15px]" />
      <PromptInputFooter className="px-3 pb-3">
        <PromptInputTools />
        <PromptInputSubmit status={status} onStop={stop} className="rounded-full" />
      </PromptInputFooter>
    </PromptInput>
  );
  const empty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-background font-sans">
      <header className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded-lg px-2 py-1.5 font-display text-lg font-medium">Doot</span>
          {installPrompt && (
            <button onClick={installApp} className="rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
              Install app
            </button>
          )}
        </div>
        <button
          onClick={() => setMessages([])}
          aria-label="নতুন চ্যাট"
          className="grid size-9 place-items-center rounded-lg text-foreground hover:bg-accent"
        >
          <SquarePen className="size-5" />
        </button>
      </header>

      {empty ? (
        <main className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
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
        <>
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
                  </MessageContent>
                </Message>
              ))}
              {status === "submitted" && <Shimmer>ভাবছি...</Shimmer>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
          <div className="mx-auto w-full max-w-3xl px-4 pb-3">
            {composer}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Liza ভুল করতে পারে। গুরুত্বপূর্ণ তথ্য যাচাই করুন।
            </p>
          </div>
        </>
      )}
    </div>
  );
}
