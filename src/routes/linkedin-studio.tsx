import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  buildLinkedInContentStrategy,
  createLinkedInContentCalendar,
  generateDailyPostIdeas,
  generateLinkedInPostDraft,
  type ContentFormat,
  type ContentLanguage,
  type ContentPillar,
  type LinkedInPostDraft,
} from "@/lib/agents/linkedin-content-studio";

export const Route = createFileRoute("/linkedin-studio")({
  head: () => ({ meta: [{ title: "LinkedIn Content Studio — Liza" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: LinkedInStudioPage,
});

const formats: ContentFormat[] = ["professional", "storytelling", "educational", "opinion", "case-study", "carousel", "document"];

function LinkedInStudioPage() {
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("Build a credible professional presence");
  const [niche, setNiche] = useState("");
  const [pillarName, setPillarName] = useState("Practical learning");
  const [pillarPurpose, setPillarPurpose] = useState("Share useful, evidence-aware lessons");
  const [audienceNeed, setAudienceNeed] = useState("Actionable guidance");
  const [topics, setTopics] = useState("");
  const [voice, setVoice] = useState("Authentic, clear and professional");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [strategy, setStrategy] = useState<ReturnType<typeof buildLinkedInContentStrategy> | null>(null);
  const [calendar, setCalendar] = useState<ReturnType<typeof createLinkedInContentCalendar>>([]);
  const [topic, setTopic] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [personalExperience, setPersonalExperience] = useState("");
  const [format, setFormat] = useState<ContentFormat>("educational");
  const [language, setLanguage] = useState<ContentLanguage>("en");
  const [draft, setDraft] = useState<LinkedInPostDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildStrategy = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const pillar: ContentPillar = {
      name: pillarName,
      purpose: pillarPurpose,
      audienceNeed,
      topics: topics.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    };
    if (!audience.trim() || !goal.trim() || !niche.trim() || !pillar.name.trim() || !pillar.purpose.trim() || !pillar.audienceNeed.trim() || !pillar.topics.length) {
      setError("Audience, goal, niche and at least one content-pillar topic are required.");
      return;
    }
    const next = buildLinkedInContentStrategy({ audience, goal, niche, pillars: [pillar], voice, language });
    setStrategy(next);
    setCalendar(createLinkedInContentCalendar({ startDate, days: 28, pillars: next.pillars, postsPerWeek: 3 }));
    setDraft(null);
  };

  const buildDraft = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!topic.trim() || !audience.trim()) {
      setError("Enter a topic and target audience before creating a draft outline.");
      return;
    }
    setDraft(generateLinkedInPostDraft({
      topic, audience, keyPoints: keyPoints.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
      personalExperience, voice, format, language,
    }));
  };

  const ideas = strategy ? generateDailyPostIdeas(strategy.pillars, 10) : [];

  return (
    <main id="linkedin-studio-main" className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-8">
      <a href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to chat</a>
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">LinkedIn workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Content Studio</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Create a content strategy, a 28-day planning calendar and structured post outlines using information you provide.</p>
        </header>

        <div className="mb-5 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <strong>Draft-only mode:</strong> This workspace does not connect to LinkedIn, publish, schedule, send messages or save drafts to a server. Generated post content is a structured outline, not finished AI-written copy. Do not enter confidential information.
        </div>
        {error && <p role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</p>}

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">1. Content strategy</h2>
          <form onSubmit={buildStrategy} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">Target audience
              <input value={audience} onChange={(e) => setAudience(e.target.value)} required maxLength={200} className="rounded-lg border border-border bg-background px-3 py-2" placeholder="e.g. junior data analysts" />
            </label>
            <label className="grid gap-1 text-sm">Primary goal
              <input value={goal} onChange={(e) => setGoal(e.target.value)} required maxLength={300} className="rounded-lg border border-border bg-background px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">Professional niche
              <input value={niche} onChange={(e) => setNiche(e.target.value)} required maxLength={200} className="rounded-lg border border-border bg-background px-3 py-2" placeholder="e.g. business analytics and career learning" />
            </label>
            <label className="grid gap-1 text-sm">Content pillar
              <input value={pillarName} onChange={(e) => setPillarName(e.target.value)} required maxLength={100} className="rounded-lg border border-border bg-background px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">Pillar purpose
              <input value={pillarPurpose} onChange={(e) => setPillarPurpose(e.target.value)} required maxLength={300} className="rounded-lg border border-border bg-background px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">Audience need
              <input value={audienceNeed} onChange={(e) => setAudienceNeed(e.target.value)} required maxLength={300} className="rounded-lg border border-border bg-background px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">Brand voice
              <input value={voice} onChange={(e) => setVoice(e.target.value)} maxLength={300} className="rounded-lg border border-border bg-background px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">Topics (one per line)
              <textarea value={topics} onChange={(e) => setTopics(e.target.value)} required rows={4} maxLength={3000} className="rounded-lg border border-border bg-background p-3" placeholder={"SQL learning\nPortfolio projects\nCareer lessons"} />
            </label>
            <label className="grid gap-1 text-sm">Calendar start date
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="rounded-lg border border-border bg-background px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">Writing language
              <select value={language} onChange={(e) => setLanguage(e.target.value as ContentLanguage)} className="rounded-lg border border-border bg-background px-3 py-2">
                <option value="bn">বাংলা</option><option value="en">English</option><option value="banglish">Banglish</option>
              </select>
            </label>
            <div className="sm:col-span-2"><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Build strategy & calendar</button></div>
          </form>
        </section>

        {strategy && <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Strategy summary</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div><dt className="text-muted-foreground">Audience</dt><dd>{strategy.audience}</dd></div>
              <div><dt className="text-muted-foreground">Goal</dt><dd>{strategy.goal}</dd></div>
              <div><dt className="text-muted-foreground">Niche</dt><dd>{strategy.niche}</dd></div>
              <div><dt className="text-muted-foreground">Voice</dt><dd>{strategy.voice}</dd></div>
            </dl>
            <h3 className="mt-5 font-medium">Recommended cadence</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{strategy.recommendedCadence.map((item) => <li key={item}>{item}</li>)}</ul>
            <h3 className="mt-5 font-medium">Topic ideas</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{ideas.map((item) => <li key={item}>{item}</li>)}</ul>
            <p className="mt-4 text-xs text-muted-foreground">{strategy.limitations.join(" ")}</p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">28-day calendar</h2>
            <p className="mt-1 text-xs text-muted-foreground">Planning suggestions only; no posts are scheduled or published.</p>
            {calendar.length ? <ol className="mt-4 space-y-3">{calendar.map((entry) => <li key={entry.id} className="flex items-start justify-between gap-3 border-b border-border pb-2 text-sm"><div><p className="font-medium">{entry.topic}</p><p className="text-xs text-muted-foreground">{entry.pillar} · {entry.format}</p></div><time className="shrink-0 text-xs tabular-nums text-muted-foreground">{entry.date}</time></li>)}</ol> : <p className="mt-4 text-sm text-muted-foreground">No calendar slots were generated for this date range.</p>}
          </article>
        </section>}

        <section className="mt-5 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">2. Post outline builder</h2>
          <form onSubmit={buildDraft} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm sm:col-span-2">Post topic
              <input value={topic} onChange={(e) => setTopic(e.target.value)} required maxLength={200} className="rounded-lg border border-border bg-background px-3 py-2" placeholder="What is this post about?" />
            </label>
            <label className="grid gap-1 text-sm">Format
              <select value={format} onChange={(e) => setFormat(e.target.value as ContentFormat)} className="rounded-lg border border-border bg-background px-3 py-2">{formats.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            </label>
            <label className="grid gap-1 text-sm">Language
              <select value={language} onChange={(e) => setLanguage(e.target.value as ContentLanguage)} className="rounded-lg border border-border bg-background px-3 py-2"><option value="bn">বাংলা</option><option value="en">English</option><option value="banglish">Banglish</option></select>
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">Key points (one per line)
              <textarea value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)} rows={4} maxLength={4000} className="rounded-lg border border-border bg-background p-3" placeholder={"Main point one\nEvidence you can support\nPractical takeaway"} />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">Personal experience (optional)
              <textarea value={personalExperience} onChange={(e) => setPersonalExperience(e.target.value)} rows={3} maxLength={1000} className="rounded-lg border border-border bg-background p-3" />
            </label>
            <div className="sm:col-span-2"><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Generate post outline</button></div>
          </form>
          {draft && <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="font-semibold">{draft.topic}</h3>
            <p className="mt-2 text-sm font-medium">{draft.hook}</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{draft.bodyOutline.map((item, index) => <li key={index}>{item}</li>)}</ul>
            <p className="mt-3 text-sm">{draft.callToAction}</p>
            <p className="mt-4 text-xs text-muted-foreground">{draft.generationNote} Status: {draft.publicationStatus}.</p>
          </div>}
        </section>
      </div>
    </main>
  );
}
