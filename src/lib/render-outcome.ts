// Shared by server render steps and the browser retry chain. Browser-safe: no secrets here.
export type RenderProvider = "meta" | "fallback";
export type RenderOutcome =
  | { ok: true; image: string; provider: RenderProvider }
  | { ok: false; message: string; retryable: boolean; status: number };
export type RenderStatus = "idle" | "generating" | "retrying" | "fallback" | "done" | "error";
export const RENDER_STATUS_LABEL: Record<RenderStatus, string> = {
  idle: "Waiting…", generating: "Generating…", retrying: "Retrying…", fallback: "Using fallback…", done: "Done", error: "Failed",
};
export const RENDER_ERRORS = {
  notFound: "Image service not found. Check Muse Image endpoint / access.",
  auth: "Image API key invalid or no access.",
  busy: "Too many requests, please wait 30 seconds.",
  other: "Generation failed, please try again.",
  missingKey: "MODEL_API_KEY is missing in Cloud Secrets.",
} as const;
export function renderErrorMessage(status: number) {
  if (status === 404) return RENDER_ERRORS.notFound;
  if (status === 401 || status === 403) return RENDER_ERRORS.auth;
  if (status === 429) return RENDER_ERRORS.busy;
  return RENDER_ERRORS.other;
}
// Only a missing route/model or a Meta server failure moves on to retry and fallback.
export const isRetryableStatus = (status: number) => status === 404 || status >= 500;

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
/** Meta → wait → Meta again → fallback provider, reporting each stage. */
export async function renderWithFallback(
  attempt: (provider: RenderProvider) => Promise<RenderOutcome>,
  onStatus: (status: RenderStatus) => void = () => {},
  waitMs = 2000,
): Promise<{ image: string; provider: RenderProvider }> {
  onStatus("generating");
  let result = await attempt("meta");
  if (!result.ok && result.retryable) {
    onStatus("retrying");
    await pause(waitMs);
    result = await attempt("meta");
  }
  if (!result.ok && result.retryable) {
    onStatus("fallback");
    result = await attempt("fallback");
  }
  if (!result.ok) { onStatus("error"); throw new Error(result.message); }
  onStatus("done");
  return { image: result.image, provider: result.provider };
}
