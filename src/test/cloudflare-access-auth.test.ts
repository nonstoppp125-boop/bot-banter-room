import { describe, expect, it } from "vitest";
import { handleCloudflareAccessSessionRequest, verifyCloudflareAccessAssertion } from "@/lib/agents/cloudflare-access-auth";

const teamDomain = "example.cloudflareaccess.com";
const audience = "liza-access-audience";
const now = Math.floor(Date.now() / 1000);
const encoder = new TextEncoder();
function base64url(bytes: Uint8Array) {
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function signedAssertion(overrides: Record<string, unknown> = {}) {
  const pair = await crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256",
  }, true, ["sign", "verify"]) as CryptoKeyPair;
  const exported = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const jwk = { ...exported, kid: "key-1", use: "sig", alg: "RS256" } as JsonWebKey & { kid: string; use: string; alg: string };
  const header = base64url(encoder.encode(JSON.stringify({ alg: "RS256", kid: "key-1", typ: "JWT" })));
  const claims = base64url(encoder.encode(JSON.stringify({
    iss: "https://" + teamDomain, aud: [audience], sub: "identity-123",
    email: "user@example.com", name: "Test User",
    iat: now, nbf: now - 5, exp: now + 600, ...overrides,
  })));
  const input = header + "." + claims;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, encoder.encode(input));
  return {
    token: input + "." + base64url(new Uint8Array(signature)),
    jwks: { keys: [jwk] },
  };
}

describe("Cloudflare Access authentication", () => {
  it("verifies RS256 signature, issuer, audience and time claims", async () => {
    const signed = await signedAssertion();
    const identity = await verifyCloudflareAccessAssertion({
      token: signed.token, teamDomain, audience, nowSeconds: now,
      fetcher: async () => new Response(JSON.stringify(signed.jwks)),
    });
    expect(identity).toMatchObject({ subject: "identity-123", email: "user@example.com", name: "Test User" });
  });

  it("rejects wrong audience and expired assertions", async () => {
    const wrongAudience = await signedAssertion({ aud: ["other"] });
    await expect(verifyCloudflareAccessAssertion({
      token: wrongAudience.token, teamDomain, audience, nowSeconds: now,
      fetcher: async () => new Response(JSON.stringify(wrongAudience.jwks)),
    })).rejects.toThrow();
    const expired = await signedAssertion({ exp: now - 1 });
    await expect(verifyCloudflareAccessAssertion({
      token: expired.token, teamDomain, audience, nowSeconds: now,
      fetcher: async () => new Response(JSON.stringify(expired.jwks)),
    })).rejects.toThrow();
  });

  it("creates a scoped workspace session and sets a secure host cookie", async () => {
    const signed = await signedAssertion();
    const queries: string[] = [];
    let insertedUserId = "";
    const database = {
      prepare(query: string) {
        queries.push(query);
        return {
          bind(...values: unknown[]) {
            if (query.startsWith("INSERT INTO users")) insertedUserId = String(values[0]);
            return {
              run: async () => ({ success: true, meta: { changes: 1 } }),
              first: async <T = Record<string, unknown>>() => query.includes("SELECT id FROM users")
                ? { id: insertedUserId } as T : null,
            };
          },
        };
      },
    };
    const request = new Request("https://liza.example/api/auth/session", {
      headers: { "cf-access-jwt-assertion": signed.token },
    });
    const response = await handleCloudflareAccessSessionRequest(request, {
      ACTION_DB: database, CF_ACCESS_TEAM_DOMAIN: teamDomain, CF_ACCESS_AUD: audience,
      CF_ACCESS_ALLOWED_EMAIL_DOMAINS: "example.com",
    }, async () => new Response(JSON.stringify(signed.jwks)));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://liza.example/");
    expect(response.headers.get("set-cookie")).toContain("__Host-liza_session=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(queries.some((query) => query.includes("INSERT INTO sessions"))).toBe(true);
    expect(queries.some((query) => query.includes("INSERT OR IGNORE INTO workspace_members"))).toBe(true);
  });

  it("rejects unconfigured or missing Access assertions", async () => {
    const noConfig = await handleCloudflareAccessSessionRequest(
      new Request("https://liza.example/api/auth/session"), {},
    );
    expect(noConfig.status).toBe(503);
    const noAssertion = await handleCloudflareAccessSessionRequest(
      new Request("https://liza.example/api/auth/session"),
      {
        ACTION_DB: { prepare: () => ({ bind: () => ({ run: async () => ({ success: true }), first: async () => null }) }) },
        CF_ACCESS_TEAM_DOMAIN: teamDomain, CF_ACCESS_AUD: audience,
      },
    );
    expect(noAssertion.status).toBe(401);
  });
});
