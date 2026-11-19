/**
 * Shared limits for outbound Groq requests.
 * SDK retries are bounded; caller cancellation remains independently supported.
 */
export const PROVIDER_REQUEST_OPTIONS = {
  maxRetries: 1,
  timeout: {
    totalMs: 45_000,
    firstChunkMs: 20_000,
    chunkMs: 15_000,
  },
} as const;
