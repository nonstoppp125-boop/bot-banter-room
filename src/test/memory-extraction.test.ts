import { describe, expect, it } from "vitest";
import { extractExplicitMemory } from "@/lib/agents/memory-extraction";

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
  });

  it("does not infer durable memories from ordinary conversation", () => {
    expect(extractExplicitMemory("I prefer concise replies.")).toBeNull();
    expect(extractExplicitMemory("Can you remember what I said yesterday?")).toBeNull();
  });

  it("rejects credential-like content and oversized requests", () => {
    expect(extractExplicitMemory("Remember my api_key=super-secret")).toBeNull();
    expect(extractExplicitMemory("Remember this: " + "x".repeat(4_500))).toBeNull();
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
