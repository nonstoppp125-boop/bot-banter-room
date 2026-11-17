import type { MemoryCategory } from "./memory-store";

export type ExplicitMemory = {
  category: MemoryCategory;
  content: string;
};

const SECRET_PATTERN =
  /(?:password|api[_ -]?key|secret|access token|refresh token|private key|one[- ]time password|\botp\b)\s*[:=]|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~-]{12,}|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b/i;

const EXPLICIT_TRIGGERS = [
  /^(?:please\s+)?remember(?:\s+(?:that|this))?\s*[:,—-]?\s*(.+)$/i,
  /^(?:মনে\s+রেখো|মনে\s+রাখবে|মনে\s+রাখো|মনে\s+রাখবেন|মনে\s+রাখ)\s*[,ঃ:—-]?\s*(.+)$/u,
  /^(?:mone\s+rekho|mone\s+rakhbe|mone\s+rakho)\s*[:,—-]?\s*(.+)$/i,
];

function inferCategory(content: string): MemoryCategory {
  if (/\b(project|repository|app)\b|প্রজেক্ট|প্রকল্প/i.test(content)) return "project";
  if (/\b(workflow|process|routine|steps?)\b|কাজের নিয়ম|পদ্ধতি|ধাপ/u.test(content)) return "workflow";
  if (/\b(prefer|preference|like|dislike|want|always|never)\b|পছন্দ|ভালো লাগে|চাই|সবসময়|কখনোই/u.test(content)) return "preference";
  return "other";
}

/**
 * Extracts only text explicitly introduced by a remember/save command.
 * Ordinary conversation is never promoted to durable memory automatically.
 */
export function extractExplicitMemory(text: string): ExplicitMemory | null {
  const normalized = text.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!normalized || normalized.length > 4_500) return null;

  for (const trigger of EXPLICIT_TRIGGERS) {
    const match = normalized.match(trigger);
    const content = match?.[1]?.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
    if (!content || content.length > 4_000 || SECRET_PATTERN.test(content)) return null;
    return { category: inferCategory(content), content };
  }
  return null;
}
