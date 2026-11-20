import { createFileRoute } from "@tanstack/react-router";
import { createD1SessionStore, readSessionCookie } from "@/lib/agents/session-auth";
import { createDevPilotApprovalStore } from "@/lib/agents/devpilot-approval-store";
import type { AgentEnv } from "@/lib/agents/types";

type RuntimeRequest = Request & { runtime?: { cloudflare?: { env?: AgentEnv } } };
const MAX_BODY = 16_384;
function getEnv(request: Request): AgentEnv {
  return (request as RuntimeRequest).runtime?.cloudflare?.env ?? {};
}
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}
async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const length = request.headers.get("content-length");
  if (length && Number.isFinite(Number(length)) && Number(length) > MAX_BODY) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY) { void reader.cancel().catch(() => undefined); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : null;
  } catch { return null; }
  finally { reader.releaseLock(); }
}
async function getSession(request: Request) {
  if (!sameOrigin(request)) return { response: Response.json({ error: "Invalid request origin." }, { status: 403 }) } as const;
  const env = getEnv(request);
  if (!env.ACTION_DB) return { response: Response.json({ error: "Approval storage is unavailable." }, { status: 503 }) } as const;
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return { response: Response.json({ error: "Authentication required." }, { status: 401 }) } as const;
  const now = new Date().toISOString();
  const session = await createD1SessionStore(env.ACTION_DB).getActive(token, now);
  if (!session?.workspaceId) return { response: Response.json({ error: "An active workspace session is required." }, { status: 403 }) } as const;
  return { env, session, now } as const;
}
export const Route = createFileRoute("/api/devpilot/approvals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = await getSession(request);
          if ("response" in auth) return auth.response;
          const body = await readBody(request);
          if (!body || typeof body.taskId !== "string" || typeof body.repository !== "string" ||
            typeof body.payloadHash !== "string" || typeof body.summary !== "string") {
            return Response.json({ error: "Invalid approval request." }, { status: 400 });
          }
          const id = crypto.randomUUID().replace(/-/g, "");
          const expiresAt = new Date(Date.parse(auth.now) + 24 * 60 * 60 * 1000).toISOString();
          await createDevPilotApprovalStore(auth.env.ACTION_DB!).create({
            id, workspaceId: auth.session.workspaceId!, userId: auth.session.userId,
            taskId: body.taskId, repository: body.repository, payloadHash: body.payloadHash,
            summary: body.summary, createdAt: auth.now, expiresAt,
          });
          return Response.json({ approvalId: id, status: "pending", expiresAt }, { status: 201 });
        } catch {
          return Response.json({ error: "Unable to create approval request." }, { status: 400 });
        }
      },
      PATCH: async ({ request }) => {
        try {
          const auth = await getSession(request);
          if ("response" in auth) return auth.response;
          const body = await readBody(request);
          if (!body || typeof body.approvalId !== "string" ||
            (body.decision !== "approved" && body.decision !== "rejected") ||
            typeof body.reason !== "string") {
            return Response.json({ error: "Invalid approval decision." }, { status: 400 });
          }
          const updated = await createDevPilotApprovalStore(auth.env.ACTION_DB!).decide({
            id: body.approvalId, workspaceId: auth.session.workspaceId!, actorUserId: auth.session.userId,
            decision: body.decision, reason: body.reason, now: auth.now,
          });
          return updated
            ? Response.json({ approvalId: body.approvalId, status: body.decision })
            : Response.json({ error: "Approval is unavailable, expired or already decided." }, { status: 409 });
        } catch {
          return Response.json({ error: "Unable to record approval decision." }, { status: 400 });
        }
      },
    },
  },
});
