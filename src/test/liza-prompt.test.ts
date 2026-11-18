import { describe, expect, it } from "vitest";
import { buildLizaSystem, detectReplyLanguage } from "@/lib/agents/liza-prompt";

function userMessage(text: string) {
  return [{
    id: "message-1",
    role: "user" as const,
    parts: [{ type: "text" as const, text }],
  }];
}

describe("Liza multilingual response policy", () => {
  it("detects Bengali script and explicitly instructs Bengali-script replies", () => {
    const messages = userMessage("আমাকে বাংলায় বুঝিয়ে বলো");
    expect(detectReplyLanguage(messages)).toBe("bangla");
    expect(buildLizaSystem(messages)).toContain("Reply in Bengali script");
  });

  it("detects Banglish and preserves Latin-script Banglish", () => {
    const messages = userMessage("Ami ekhon project ta korte chai");
    expect(detectReplyLanguage(messages)).toBe("banglish");
    expect(buildLizaSystem(messages)).toContain("Reply in Banglish using Latin script");
  });

  it("detects English without translating or switching language", () => {
    const messages = userMessage("Explain how database indexes work");
    expect(detectReplyLanguage(messages)).toBe("english");
    expect(buildLizaSystem(messages)).toContain("Reply in clear, natural English");
  });

  it("uses English as a safe fallback when there is no text user message", () => {
    expect(detectReplyLanguage([])).toBe("english");
    expect(buildLizaSystem([])).toContain("Reply in clear, natural English");
  });
});
