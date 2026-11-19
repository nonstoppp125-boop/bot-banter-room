import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("core route accessibility contracts", () => {
  it("provides a keyboard skip link, named primary navigation and main landmark in chat", () => {
    const chat = source("src/routes/index.tsx");
    expect(chat).toContain('href="#main-content"');
    expect(chat).toContain('id="main-content"');
    expect(chat).toContain('aria-label="প্রধান নেভিগেশন"');
    expect(chat).toContain('<nav aria-label=');
  });

  it("announces chat errors and task save feedback to assistive technology", () => {
    const chat = source("src/routes/index.tsx");
    expect(chat).toContain('role="alert"');
    expect(chat).toContain('role="status"');
  });

  it("provides a named file-import control and accessible error/status regions in analytics", () => {
    const analytics = source("src/routes/analytics.tsx");
    expect(analytics).toContain("Import CSV");
    expect(analytics).toContain('type="file"');
    expect(analytics).toContain('role="alert"');
    expect(analytics).toContain('role="status"');
    expect(analytics).toContain("<main");
    expect(analytics).toContain("<h1");
  });

  it("keeps the approval inbox warning and errors announced", () => {
    const approvals = source("src/routes/settings.approvals.tsx");
    expect(approvals).toContain('role="alert"');
    expect(approvals).toContain('role="status"');
    expect(approvals).toContain("Approving a request records authorization only");
  });
});
