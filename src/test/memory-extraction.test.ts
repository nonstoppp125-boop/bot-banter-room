import { describe, expect, it } from "vitest";
import { extractExplicitMemory, hasExplicitMemoryTrigger } from "@/lib/agents/memory-extraction";

describe("explicit memory extraction", () => {
  it("extracts only a direct English remember instruction", () => {
    expect(extractExplicitMemory("Please remember that I prefer concise replies.")).toEqual({
      category: "preference",
      content: "I prefer concise replies.",
    });
  });

  it("supports Bengali and Banglish remember commands", () => {
    expect(extractExplicitMemory("মনে রেখো, আমি বাংলা লিপিতে উত্তর পছন্দ করি")).toMatchObject({
      category: "preference",
      content: "আমি বাংলা লিপিতে উত্তর পছন্দ করি",
    });
    expect(extractExplicitMemory("Mone rekho amar project XterLiza")).toMatchObject({
      category: "project",
      content: "amar project XterLiza",
    });
    expect(extractExplicitMemory("মনে রেখো আমার প্রকল্পের নাম Doot")).toMatchObject({
      category: "project",
    });
  });

  it("does not infer durable memories from ordinary conversation", () => {
    expect(extractExplicitMemory("I prefer concise replies.")).toBeNull();
    expect(extractExplicitMemory("Can you remember what I said yesterday?")).toBeNull();
  });

  it("rejects credential-like content and oversized requests", () => {
    expect(extractExplicitMemory("Remember my api_key=super-secret")).toBeNull();
    expect(extractExplicitMemory("Remember this: Bearer abcdefghijklmnop")).toBeNull();
    expect(extractExplicitMemory("Remember this: ghp_abcdefghijklmnopqrstuvwxyz1234567890")).toBeNull();
    expect(extractExplicitMemory("Remember this: " + "x".repeat(4_500))).toBeNull();
  });

  it("recognizes explicit save intent even when the content is rejected as secret", () => {
    expect(hasExplicitMemoryTrigger("Remember my api_key=super-secret")).toBe(true);
    expect(hasExplicitMemoryTrigger("মনে রেখো: Bearer abcdefghijklmnop")).toBe(true);
    expect(hasExplicitMemoryTrigger("I prefer concise replies.")).toBe(false);
  });

  it("classifies workflow and project memories", () => {
    expect(extractExplicitMemory("Remember my workflow: review every change first")).toMatchObject({
      category: "workflow",
    });
    expect(extractExplicitMemory("Remember my project is Doot")).toMatchObject({
      category: "project",
    });
  });
});
