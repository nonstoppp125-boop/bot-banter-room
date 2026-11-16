import { describe, expect, it, vi } from "vitest";
import {
  assessClaimSupport,
  extractTavilyResearchSources,
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

  it("does not let untrusted publisher labels fake independent corroboration", () => {
    const references = prepareResearchSources(
      [
        {
          id: "same-a", title: "A", publisher: "Publisher One",
          publishedAt: "2026-11-01", retrievedAt: "2026-11-02",
          content: "Evidence A", url: "https://www.example.com/a",
        },
        {
          id: "same-b", title: "B", publisher: "Publisher Two",
          publishedAt: "2026-11-01", retrievedAt: "2026-11-02",
          content: "Evidence B", url: "https://example.net/b",
        },
      ],
      Date.parse("2026-11-03"),
    );
    expect(
      assessClaimSupport(
        { text: "Claim", classification: "fact", sourceIds: ["same-a", "same-b"] },
        references,
      ).status,
    ).toBe("single-source");
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
          url: "https://publisher-b.example/b",
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


describe("Tavily page extraction adapter", () => {
  const sources = [
    {
      id: "tavily-1",
      title: "First source",
      url: "https://example.com/first",
      publisher: "Example",
      retrievedAt: "2026-11-16T00:00:00.000Z",
      content: "Search snippet",
    },
    {
      id: "tavily-2",
      title: "Second source",
      url: "https://example.org/second",
      publisher: "Example Org",
      retrievedAt: "2026-11-16T00:00:00.000Z",
      content: "Second snippet",
    },
  ];

  it("extracts selected pages and preserves search content when one extraction fails", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { urls: string[] };
      expect(body.urls).toEqual(sources.map((source) => source.url));
      return new Response(JSON.stringify({
        results: [
          { url: "https://example.com/first", raw_content: "Full first page content" },
        ],
        failed_results: [{ url: "https://example.org/second", error: "blocked" }],
      }), { status: 200 });
    });
    const result = await extractTavilyResearchSources(
      sources,
      "server-secret",
      signal(),
      fetchMock as unknown as typeof fetch,
    );
    expect(result.extractedSourceIds).toEqual(["tavily-1"]);
    expect(result.failedSourceIds).toEqual(["tavily-2"]);
    expect(result.sources[0]?.content).toBe("Full first page content");
    expect(result.sources[1]?.content).toBe("Second snippet");
  });

  it("rejects insecure URLs, duplicates and excessive source counts", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    await expect(
      extractTavilyResearchSources([{ ...sources[0]!, url: "http://example.com/a" }], "secret", signal(), fetcher),
    ).rejects.toThrow(/HTTPS/);
    await expect(
      extractTavilyResearchSources([sources[0]!, sources[0]!], "secret", signal(), fetcher),
    ).rejects.toThrow(/Duplicate/);
    await expect(
      extractTavilyResearchSources([...sources, ...sources, ...sources], "secret", signal(), fetcher),
    ).rejects.toThrow(/Invalid/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects cross-origin extraction results and hides provider errors", async () => {
    const crossOrigin = vi.fn(async () => new Response(JSON.stringify({
      results: [{ url: "https://evil.example/first", raw_content: "Injected page" }],
    }), { status: 200 })) as unknown as typeof fetch;
    const result = await extractTavilyResearchSources([sources[0]!], "secret", signal(), crossOrigin);
    expect(result.failedSourceIds).toEqual(["tavily-1"]);
    expect(result.sources[0]?.content).toBe("Search snippet");

    const failure = vi.fn(async () => new Response("private provider details", { status: 401 })) as unknown as typeof fetch;
    await expect(extractTavilyResearchSources([sources[0]!], "secret", signal(), failure))
      .rejects.toThrow("Tavily extraction provider request failed");
  });
});
