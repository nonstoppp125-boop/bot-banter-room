import { createD1ApprovalStore, hashApprovalPayload, type ApprovalAction } from "./approval-store";
import { createD1SessionStore, readSessionCookie } from "./session-auth";
import { authorizeWorkspaceRole, createD1WorkspaceAccessStore } from "./workspace-store";

type ApprovalApiDatabase = Parameters<typeof createD1ApprovalStore>[0] &
  Parameters<typeof createD1SessionStore>[0] &
  Parameters<typeof createD1WorkspaceAccessStore>[0];

export type ApprovalApiEnv = { ACTION_DB?: ApprovalApiDatabase };

const noStore = { "Cache-Control": "no-store" };
const approvalActions = new Set<ApprovalAction>(["social.publish", "social.reply", "external.message", "account.change", "destructive.delete", "deployment", "financial.action"]);
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: noStore });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type ApprovalBodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 };

async function readSmallJson(request: Request): Promise<ApprovalBodyResult> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) return { ok: false, status: 400 };
    if (Number(declared) > 8192) return { ok: false, status: 413 };
  }
  if (!request.body) return { ok: false, status: 400 };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > 8192) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
    if (totalBytes === 0) return { ok: false, status: 400 };
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
    } catch {
      return { ok: false, status: 400 };
    }
  } catch {
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }
}

/** Session-authenticated approval request, inbox and decision API. */
export async function handleApprovalRequest(
  request: Request,
  env: ApprovalApiEnv,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }
  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return json({ error: "Cross-origin approval decisions are blocked." }, 403);
    }
    const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (contentType !== "application/json") {
      return json({ error: "JSON content type is required." }, 415);
    }
  }

  const database = env.ACTION_DB;
  if (!database) return json({ error: "Approval service is not configured." }, 503);

  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ error: "Authentication required." }, 401);

  try {
    const now = new Date().toISOString();
    const sessions = createD1SessionStore(database);
    const session = await sessions.getActive(token, now);
    if (!session || !session.workspaceId) return json({ error: "Active workspace session required." }, 401);

    const access = createD1WorkspaceAccessStore(database);
    const membership = await access.getMembership(session.workspaceId, session.userId);
    if (!membership) return json({ error: "Workspace membership required." }, 403);
    const approvals = createD1ApprovalStore(database);
    if (request.method === "GET") {
      const authorization = authorizeWorkspaceRole({
        membership, workspaceId: session.workspaceId, userId: session.userId, requiredRole: "admin",
      });
      if (!authorization.allowed) return json({ error: "Workspace administrator access required." }, 403);
      const pending = await approvals.listPending({
        workspaceId: session.workspaceId, actorUserId: session.userId, now, limit: 50,
      });
      return json({ approvals: pending });
    }

    const parsed = await readSmallJson(request);
    if (!parsed.ok) {
      return json(
        { error: parsed.status === 413 ? "Approval request body is too large." : "Invalid approval JSON payload." },
        parsed.status,
      );
    }
    const body = parsed.value;
    if (!isRecord(body)) return json({ error: "Invalid approval payload." }, 400);

    if (body["operation"] === "request") {
      if (typeof body["actionType"] !== "string" ||
          !approvalActions.has(body["actionType"] as ApprovalAction) ||
          typeof body["summary"] !== "string" || !body["summary"].trim() ||
          body["summary"].length > 500 ||
          !Object.prototype.hasOwnProperty.call(body, "payload")) {
        return json({ error: "Invalid approval request payload." }, 400);
      }
      const payloadHash = await hashApprovalPayload(body["payload"]);
      const expiresAt = new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString();
      const id = crypto.randomUUID().replace(/-/g, "");
      await approvals.create({
        id, workspaceId: session.workspaceId, userId: session.userId,
        actionType: body["actionType"] as ApprovalAction, payloadHash,
        summary: body["summary"], expiresAt, createdAt: now,
      });
      return json({ id, status: "pending", expiresAt }, 201);
    }

    const authorization = authorizeWorkspaceRole({
      membership, workspaceId: session.workspaceId, userId: session.userId, requiredRole: "admin",
    });
    if (!authorization.allowed) return json({ error: "Workspace administrator access required." }, 403);
    if (typeof body["approvalId"] !== "string" ||
        (body["decision"] !== "approved" && body["decision"] !== "rejected") ||
        typeof body["reason"] !== "string" || body["reason"].trim().length < 1 ||
        body["reason"].length > 1000) {
      return json({ error: "Invalid approval decision payload." }, 400);
    }
    const changed = await approvals.decide({
      id: body["approvalId"], workspaceId: session.workspaceId, actorUserId: session.userId,
      decision: body["decision"], reason: body["reason"], now,
    });
    if (!changed) return json({ error: "Approval is no longer pending, has expired, or is unavailable." }, 409);
    return json({ approved: body["decision"] === "approved" });
  } catch {
    return json({ error: "Approval request could not be completed." }, 500);
  }
}
