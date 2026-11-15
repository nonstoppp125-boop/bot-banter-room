import { describe, expect, it, vi } from "vitest";
import {
  assessClaimSupport,
  openResearchSource,
  prepareResearchSources,
  searchResearchSources,
  searchTavilyResearch,
  type AuthorizedResearchTools,
} from "@/lib/agents/research";

const signal = () => new AbortController().signal;
const tools = (): AuthorizedResearchTools => ({
  allowedHosts: ["example.com"],
  search: vi.fn(async () => [
    {
      title: "Example result",
      url: "https://example.com/article",
      snippet: "A short evidence snippet",
      publisher: "Example News",
    },
  ]),
  open: vi.fn(async () => ({
    title: "Opened article",
    finalUrl: "https://example.com/article",
    content: "Full article evidence",
    publisher: "Example News",
  })),
});

describe("authorized research tool contract", () => {
  it("searches only through the injected provider and preserves references", async () => {
    const provider = tools();
    const sources = await searchResearchSources("market trends", provider, signal());

    expect(provider.search).toHaveBeenCalledOnce();
    expect(sources[0]?.id).toBe("web-1");
    expect(sources[0]?.url).toBe("https://example.com/article");
  });

  it("rejects unapproved hosts and non-HTTPS URLs", async () => {
    const provider = tools();
    provider.search = vi.fn(async () => [
      { title: "Bad", url: "http://example.com/a", snippet: "text" },
    ]);
    await expect(searchResearchSources("query", provider, signal())).rejects.toThrow(/HTTPS/);

    provider.search = vi.fn(async () => [
      { title: "Bad", url: "https://evil.example/a", snippet: "text" },
    ]);
    await expect(searchResearchSources("query", provider, signal())).rejects.toThrow(
      /not authorized/,
    );
  });

  it("rejects invalid search limits and cancelled requests", async () => {
    const provider = tools();
    await expect(searchResearchSources("query", provider, signal(), 11)).rejects.toThrow();
    const controller = new AbortController();
    controller.abort();
    await expect(searchResearchSources("query", provider, controller.signal)).rejects.toThrow(
      /cancelled/,
    );
  });

  it("opens only allowlisted same-origin sources", async () => {
    const provider = tools();
    const sources = await searchResearchSources("query", provider, signal());
    const opened = await openResearchSource(sources[0]!, provider, signal());

    expect(provider.open).toHaveBeenCalledOnce();
    expect(opened.content).toBe("Full article evidence");

    provider.open = vi.fn(async () => ({
      title: "Redirect",
      finalUrl: "https://evil.example/article",
      content: "Unexpected content",
    }));
    await expect(openResearchSource(sources[0]!, provider, signal())).rejects.toThrow();
  });

  it("assesses source diversity without claiming proof of truth", () => {
    const references = prepareResearchSources(
      [
        {
          id: "a",
          title: "A",
          publisher: "Publisher A",
          publishedAt: "2026-01-01",
          retrievedAt: "2026-11-01",
          content: "Evidence A",
          url: "https://example.com/a",
        },
        {
          id: "b",
          title: "B",
          publisher: "Publisher B",
          publishedAt: "2026-01-02",
          retrievedAt: "2026-11-01",
          content: "Evidence B",
          url: "https://example.com/b",
        },
      ],
      Date.parse("2026-11-02"),
    );

    expect(
      assessClaimSupport(
        { text: "Claim", classification: "fact", sourceIds: ["a", "b"] },
        references,
      ).status,
    ).toBe("corroborated");

    expect(
      assessClaimSupport({ text: "Claim", classification: "fact", sourceIds: ["a"] }, references)
        .status,
    ).toBe("single-source");
  });
});

describe("Tavily server-side research adapter", () => {
  it("uses the fixed Tavily endpoint and returns bounded cited sources", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                title: "Research result",
                url: "https://example.com/research",
                content: "Search snippet",
                raw_content: "Full retrieved evidence",
                published_date: "2026-11-01",
              },
            ],
          }),
          { status: 200 },
        ),
    );
    const fetcher = fetchMock as unknown as typeof fetch;

    const sources = await searchTavilyResearch(
      "market research",
      "server-secret",
      signal(),
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({ method: "POST" }),
    );
    expect(sources[0]?.id).toBe("tavily-1");
    expect(sources[0]?.content).toBe("Full retrieved evidence");
    expect(sources[0]?.url).toBe("https://example.com/research");
  });

  it("rejects insecure provider URLs and invalid input", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                title: "Unsafe",
                url: "http://example.com/page",
                content: "Untrusted",
              },
            ],
          }),
          { status: 200 },
        ),
    );
    const fetcher = fetchMock as unknown as typeof fetch;

    await expect(searchTavilyResearch("query", "secret", signal(), fetcher)).rejects.toThrow(
      /HTTPS/,
    );

    await expect(searchTavilyResearch("", "secret", signal(), fetcher)).rejects.toThrow(/Invalid/);
  });

  it("does not expose provider error bodies", async () => {
    const fetchMock = vi.fn(async () => new Response("private provider details", { status: 401 }));
    const fetcher = fetchMock as unknown as typeof fetch;

    await expect(searchTavilyResearch("query", "secret", signal(), fetcher)).rejects.toThrow(
      "Tavily research provider request failed",
    );
  });
});
