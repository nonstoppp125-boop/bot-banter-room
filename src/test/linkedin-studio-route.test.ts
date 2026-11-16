import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("LinkedIn Content Studio route", () => {
  it("registers a discoverable route and navigation link", () => {
    expect(read("src/routeTree.gen.ts")).toContain("'/linkedin-studio'");
    expect(read("src/routes/index.tsx")).toContain('href="/linkedin-studio"');
  });

  it("uses the existing bounded content strategy and calendar builders", () => {
    const route = read("src/routes/linkedin-studio.tsx");
    expect(route).toContain("buildLinkedInContentStrategy");
    expect(route).toContain("createLinkedInContentCalendar");
    expect(route).toContain("generateDailyPostIdeas");
    expect(route).toContain("days: 28");
  });

  it("keeps the workspace draft-only with explicit no-publish and no-persistence disclosure", () => {
    const route = read("src/routes/linkedin-studio.tsx");
    expect(route).toContain("does not connect to LinkedIn, publish, schedule, send messages or save drafts to a server");
    expect(route).toContain("generateLinkedInPostDraft");
    expect(route.toLowerCase()).toContain("draft-only");
  });
});
