import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Check,
  ChevronDown,
  Copy,
  Menu,
  MessageSquare,
  Moon,
  Plus,
  Pencil,
  Search,
  Sparkles,
  SquarePen,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
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
      { title: "Liza — আপনার AI সহকারী" },
      { name: "description", content: "Liza-এর সঙ্গে বাংলা ও ইংরেজিতে কথা বলুন, লিখুন, শিখুন এবং কাজ করুন।" },
      { property: "og:title", content: "Liza — আপনার AI সহকারী" },
      { property: "og:description", content: "আপনার প্রতিদিনের AI সহকারী।" },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#f8f9fc" },
    ],
  }),
  component: Index,
});

const suggestions = [
  { icon: "✦", title: "কিছু শিখি", prompt: "আমাকে একটি নতুন বিষয় সহজভাবে বুঝিয়ে শেখাও।" },
  { icon: "⌘", title: "লেখালেখি", prompt: "আমার জন্য একটি সুন্দর ও প্রফেশনাল লেখা তৈরি করো।" },
  { icon: "↗", title: "আইডিয়া তৈরি", prompt: "আমাকে কয়েকটি নতুন ও বাস্তবসম্মত আইডিয়া দাও।" },
  { icon: "⌁", title: "কোডিং সহায়তা", prompt: "আমি একটি প্রজেক্ট বানাতে চাই। আমাকে ধাপে ধাপে গাইড করো।" },
];

type SavedChat = { id: string; title: string; messages: UIMessage[]; updatedAt: number };

function Index() {
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<SavedChat[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (e) => setError(e.message || "সংযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন।"),
  });

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("liza-theme");
      const isDark = savedTheme === "dark";
      setDark(isDark);
      document.documentElement.classList.toggle("dark", isDark);
      const savedChats = localStorage.getItem("liza-chats");
      if (savedChats) {
        const parsed: unknown = JSON.parse(savedChats);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((item): item is SavedChat =>
            item && typeof item.id === "string" && typeof item.title === "string" &&
            Array.isArray(item.messages) && typeof item.updatedAt === "number"
          ).slice(0, 30);
          setChatHistory(valid);
          if (valid.length > 0) {
            setActiveChatId(valid[0].id);
            setMessages(valid[0].messages);
          }
        }
      }
    } catch {
      setError("এই ডিভাইসের সংরক্ষিত ডেটা পড়া যায়নি। ব্রাউজারের storage permission পরীক্ষা করুন।");
    } finally {
      setHistoryReady(true);
    }
  }, []);

  useEffect(() => {
    if (!historyReady || !activeChatId || messages.length === 0) return;
    const firstUserMessage = messages.find((message) => message.role === "user");
    const firstText = firstUserMessage?.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ").trim();
    const generatedTitle = firstText ? firstText.slice(0, 42) : "নতুন চ্যাট";
    setChatHistory((current) => {
      const previous = current.find((chat) => chat.id === activeChatId);
      const updated: SavedChat = {
        id: activeChatId,
        title: previous?.title ?? generatedTitle,
        messages,
        updatedAt: Date.now(),
      };
      const next = [updated, ...current.filter((chat) => chat.id !== activeChatId)].slice(0, 30);
      try { localStorage.setItem("liza-chats", JSON.stringify(next)); } catch {
        setError("ডিভাইসের storage পূর্ণ। পুরোনো চ্যাট মুছে জায়গা খালি করুন।");
      }
      return next;
    });
  }, [activeChatId, historyReady, messages]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("liza-theme", next ? "dark" : "light"); } catch {
      setError("থিম সংরক্ষণ করা যায়নি।");
    }
  };

  const busy = status === "submitted" || status === "streaming";
  const empty = messages.length === 0;

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setError(null);
    setSidebarOpen(false);
    if (!activeChatId) setActiveChatId(crypto.randomUUID());
    sendMessage({ text: text.trim() });
  };

  const newChat = () => {
    stop();
    setMessages([]);
    setActiveChatId(null);
    setError(null);
    setSidebarOpen(false);
  };

  const openChat = (chat: SavedChat) => {
    stop();
    setActiveChatId(chat.id);
    setMessages(chat.messages);
    setError(null);
    setSidebarOpen(false);
  };

  const renameChat = (id: string) => {
    const current = chatHistory.find((chat) => chat.id === id);
    if (!current) return;
    const nextTitle = window.prompt("চ্যাটের নতুন নাম লিখুন", current.title)?.trim();
    if (!nextTitle) return;
    setChatHistory((items) => {
      const next = items.map((chat) => chat.id === id ? { ...chat, title: nextTitle.slice(0, 80) } : chat);
      try { localStorage.setItem("liza-chats", JSON.stringify(next)); } catch {
        setError("চ্যাটের নাম সংরক্ষণ করা যায়নি।");
      }
      return next;
    });
  };

  const deleteChat = (id: string) => {
    setChatHistory((current) => {
      const next = current.filter((chat) => chat.id !== id);
      try { localStorage.setItem("liza-chats", JSON.stringify(next)); } catch {
        setError("চ্যাটের তালিকা আপডেট করা যায়নি।");
      }
      return next;
    });
    if (activeChatId === id) { setMessages([]); setActiveChatId(null); }
  };

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => current === id ? null : current), 1600);
    } catch {
      setError("কপি করা যায়নি। আপনার ব্রাউজারের clipboard permission পরীক্ষা করুন।");
    }
  };

  return (
    <div className="liza-app flex h-dvh overflow-hidden bg-background text-foreground">
      {sidebarOpen && (
        <button aria-label="সাইডবার বন্ধ করুন" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-black/35 lg:hidden" />
      )}

      <aside className={`liza-sidebar fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-border bg-[#f4f5f8] p-3 transition-transform duration-200 dark:bg-[#171922] lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-12 items-center justify-between px-2">
          <a href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-xl bg-[#6558e8] text-white shadow-sm"><Sparkles size={17} /></span>
            <span className="text-[17px]">Liza</span>
          </a>
          <button onClick={() => setSidebarOpen(false)} aria-label="বন্ধ করুন" className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 lg:hidden"><X size={18} /></button>
        </div>

        <button onClick={newChat} className="mt-5 flex h-11 items-center gap-3 rounded-xl border border-border bg-white px-3 text-sm font-medium shadow-sm transition hover:border-[#b9b3ff] hover:bg-[#faf9ff] dark:bg-white/5 dark:hover:bg-white/10">
          <SquarePen size={17} className="text-[#6558e8]" /> নতুন চ্যাট
          <span className="ml-auto rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">New</span>
        </button>

        <div className="mt-8 px-3 text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground">আপনার workspace</div>
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-3 rounded-xl bg-black/[.045] px-3 py-2.5 text-sm font-medium dark:bg-white/[.07]">
            <MessageSquare size={16} className="text-[#6558e8]" /> AI চ্যাট
            <span className="ml-auto size-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>

        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <div className="px-3 text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground">সাম্প্রতিক চ্যাট</div>
          {chatHistory.length > 0 && (
            <div className="relative mt-2">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="চ্যাট খুঁজুন..." aria-label="চ্যাট খুঁজুন" className="h-9 w-full rounded-xl border border-border bg-white/70 pl-9 pr-3 text-xs outline-none focus:border-[#9b92f5] dark:bg-white/[.04]" />
            </div>
          )}
          <div className="mt-2 space-y-1">
            {chatHistory.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">এখনো কোনো সংরক্ষিত চ্যাট নেই</p>
            ) : chatHistory.filter((chat) => chat.title.toLowerCase().includes(historyQuery.toLowerCase())).length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">কোনো চ্যাট পাওয়া যায়নি</p>
            ) : chatHistory.filter((chat) => chat.title.toLowerCase().includes(historyQuery.toLowerCase())).map((chat) => (
              <div key={chat.id} className={`group flex items-center gap-1 rounded-xl ${activeChatId === chat.id ? "bg-black/[.07] dark:bg-white/[.08]" : "hover:bg-black/[.04] dark:hover:bg-white/[.05]"}`}>
                <button onClick={() => openChat(chat)} className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-xs text-foreground">{chat.title}</button>
                <button onClick={() => renameChat(chat.id)} aria-label={`চ্যাটের নাম বদলান: ${chat.title}`} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-70 hover:bg-accent hover:text-foreground"><Pencil size={13} /></button>
                <button onClick={() => deleteChat(chat.id)} aria-label={`চ্যাট মুছুন: ${chat.title}`} className="mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive"><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto rounded-2xl border border-border/80 bg-white/75 p-3 dark:bg-white/[.04]">
          <div className="flex items-center gap-2 text-sm font-medium"><span className="grid size-7 place-items-center rounded-lg bg-[#eeeaff] text-[#6558e8] dark:bg-[#6558e8]/20"><Sparkles size={14} /></span> Liza AI</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">আপনার চিন্তা, শেখা ও কাজের সঙ্গী। আরও ভালো অভিজ্ঞতা নিয়মিত যোগ হচ্ছে।</p>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-500" /> সিস্টেম প্রস্তুত</div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[62px] shrink-0 items-center justify-between border-b border-border/70 px-3 sm:px-6">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} aria-label="মেনু খুলুন" className="grid size-9 place-items-center rounded-xl hover:bg-accent lg:hidden"><Menu size={19} /></button>
            <div className="flex items-center gap-2 text-sm font-semibold lg:hidden"><span className="grid size-7 place-items-center rounded-lg bg-[#6558e8] text-white"><Sparkles size={14} /></span>Liza</div>
            <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex"><span>AI চ্যাট</span><ChevronDown size={14} /></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-emerald-500" /> Groq AI</span>
            <button onClick={toggleTheme} aria-label={dark ? "লাইট মোড" : "ডার্ক মোড"} className="grid size-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-foreground">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button onClick={newChat} aria-label="নতুন চ্যাট" className="grid size-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-foreground"><Plus size={19} /></button>
          </div>
        </header>

        {empty ? (
          <section className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-8 pt-10">
            <div className="mb-5 grid size-[58px] place-items-center rounded-[20px] bg-gradient-to-br from-[#8175ff] to-[#5144d7] text-white shadow-[0_12px_35px_-12px_#6558e8]"><Sparkles size={27} /></div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[.18em] text-[#7468e8]">আপনার AI সহকারী</p>
            <h1 className="text-center font-display text-[30px] font-semibold tracking-tight sm:text-[38px]">আজ কী নিয়ে কাজ করব?</h1>
            <p className="mt-3 max-w-md text-center text-sm leading-6 text-muted-foreground sm:text-[15px]">প্রশ্ন করুন, আইডিয়া তৈরি করুন, নতুন কিছু শিখুন—শুরু হোক এখান থেকেই।</p>

            <div className="mt-9 w-full max-w-[760px]">{composer(send, status, stop)}</div>
            <div className="mt-5 grid w-full max-w-[760px] grid-cols-2 gap-2.5 sm:grid-cols-4">
              {suggestions.map((item) => (
                <button key={item.title} onClick={() => send(item.prompt)} className="group flex min-h-[92px] flex-col items-start justify-between rounded-2xl border border-border bg-card p-3.5 text-left transition hover:-translate-y-0.5 hover:border-[#bdb6ff] hover:shadow-md">
                  <span className="grid size-8 place-items-center rounded-xl bg-[#f0eeff] text-base text-[#6558e8] dark:bg-[#6558e8]/20">{item.icon}</span>
                  <span className="text-xs font-medium text-foreground">{item.title}</span>
                </button>
              ))}
            </div>
            <p className="mt-7 text-center text-[11px] text-muted-foreground">Liza ভুল করতে পারে। গুরুত্বপূর্ণ তথ্য যাচাই করে নিন।</p>
          </section>
        ) : (
          <>
            <Conversation className="flex-1">
              <ConversationContent className="mx-auto w-full max-w-[820px] gap-7 px-4 py-7 sm:px-8 sm:py-9">
                {messages.map((message) => {
                  const text = message.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
                  return (
                    <div key={message.id} className={message.role === "user" ? "flex flex-col items-end gap-1" : "flex flex-col items-start gap-2"}>
                      <Message from={message.role} className="max-w-full">
                        <MessageContent className={message.role === "user" ? "rounded-3xl bg-[#eeecff] px-4 py-3 text-foreground dark:bg-[#6558e8]/20" : "w-full"}>
                          {message.parts.map((part, i) => part.type === "text" ? message.role === "assistant" ? <MessageResponse key={i}>{part.text}</MessageResponse> : <span key={i} className="whitespace-pre-wrap">{part.text}</span> : null)}
                        </MessageContent>
                      </Message>
                      {message.role === "assistant" && text && (
                        <button onClick={() => copyMessage(message.id, text)} className="ml-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground">
                          {copiedId === message.id ? <Check size={13} /> : <Copy size={13} />}{copiedId === message.id ? "কপি হয়েছে" : "কপি"}
                        </button>
                      )}
                    </div>
                  );
                })}
                {status === "submitted" && <Shimmer>ভাবছি...</Shimmer>}
                {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
            <div className="mx-auto w-full max-w-[820px] px-3 pb-3 sm:px-8 sm:pb-5">
              {composer(send, status, stop)}
              <p className="mt-2 text-center text-[10px] text-muted-foreground">Liza ভুল করতে পারে। গুরুত্বপূর্ণ তথ্য যাচাই করুন।</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function composer(send: (text: string) => void, status: "submitted" | "streaming" | "ready" | "error", stop: () => void) {
  return (
    <PromptInput className="composer liza-composer rounded-[24px] border border-border bg-card shadow-[0_8px_35px_-20px_rgba(40,35,90,.25)]" onSubmit={(message) => send(message.text)}>
      <PromptInputTextarea autoFocus placeholder="Liza-কে যেকোনো কিছু জিজ্ঞেস করুন..." className="min-h-[58px] px-5 pt-4 text-[15px] leading-6" />
      <PromptInputFooter className="px-3 pb-3">
        <PromptInputTools />
        <div className="flex items-center gap-2">
          <span className="hidden text-[10px] text-muted-foreground sm:inline">Enter ↵ পাঠান</span>
          <PromptInputSubmit status={status} onStop={stop} className="size-9 rounded-full bg-[#6558e8] text-white hover:bg-[#5548d8]" />
        </div>
      </PromptInputFooter>
    </PromptInput>
  );
}
