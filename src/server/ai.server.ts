import { META_STYLE_INDEX, META_STYLE_IDS, metaPhotoPrompt, type MetaPhotoStyle } from "@/lib/meta-photo-styles";
import { RENDER_ERRORS, isRetryableStatus, renderErrorMessage, renderWithFallback, type RenderOutcome } from "@/lib/render-outcome";

// Meta Muse Image single-shot edit (https://dev.meta.ai/docs/api-reference/images/edit-image).
export const META_EDIT_URL = "https://api.meta.ai/v1/images/edits";
export const META_MODEL = "muse-image-1.0";
// Fallback: Lovable AI Gateway image edits, used only after Meta returns 404/5xx twice.
export const FALLBACK_EDIT_URL = "https://ai.gateway.lovable.dev/v1/images/edits";
export const FALLBACK_MODEL = "openai/gpt-image-2.5-sunburst";

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
function checkPhoto(imageBase64: string) {
  if (!DATA_URL.test(imageBase64) || imageBase64.length > 14_000_000) throw new Error("Choose a JPG, PNG or WEBP photo up to 10 MB.");
}

// Logs only safe diagnostic fields; never request headers, keys or full provider bodies.
async function logFailure(provider: string, response: Response, style: MetaPhotoStyle) {
  const text = await response.text().catch(() => "");
  let type: string | undefined; let code: string | undefined;
  try { const e = (JSON.parse(text) as { error?: { type?: string; code?: string } }).error; type = e?.type; code = e?.code ?? undefined; } catch { /* empty or non-JSON */ }
  console.error(`${provider} photo edit failed`, { status: response.status, style, contentType: response.headers.get("content-type"), bodyLength: text.length, type, code });
}

export async function renderMetaOnce(imageBase64: string, style: MetaPhotoStyle): Promise<RenderOutcome> {
  checkPhoto(imageBase64);
  const apiKey = process.env["MODEL_API_KEY"];
  if (!apiKey) return { ok: false, message: RENDER_ERRORS.missingKey, retryable: false, status: 0 };
  let response: Response;
  try {
    response = await fetch(META_EDIT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: META_MODEL, prompt: metaPhotoPrompt(style), images: [{ image_url: imageBase64 }], n: 1, output_format: "png" }),
    });
  } catch {
    return { ok: false, message: RENDER_ERRORS.other, retryable: true, status: 503 };
  }
  if (!response.ok) {
    await logFailure("Meta", response, style);
    return { ok: false, message: renderErrorMessage(response.status), retryable: isRetryableStatus(response.status), status: response.status };
  }
  const data = await response.json().catch(() => ({})) as { data?: { b64_json?: string }[] };
  const image = data.data?.[0]?.b64_json;
  if (!image || !/^[A-Za-z0-9+/=]+$/.test(image)) return { ok: false, message: RENDER_ERRORS.other, retryable: true, status: 502 };
  return { ok: true, image, provider: "meta" };
}

export async function renderFallbackOnce(imageBase64: string, style: MetaPhotoStyle): Promise<RenderOutcome> {
  checkPhoto(imageBase64);
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, message: "The fallback image service is not set up.", retryable: false, status: 0 };
  const [, type = "image/jpeg", b64 = ""] = DATA_URL.exec(imageBase64) ?? [];
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const form = new FormData();
  form.set("model", FALLBACK_MODEL);
  form.set("prompt", metaPhotoPrompt(style));
  form.set("size", "1024x1536");
  form.set("output_format", "png");
  form.set("image", new File([bytes], `original.${type.split("/")[1]}`, { type }));
  let response: Response;
  try {
    response = await fetch(FALLBACK_EDIT_URL, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  } catch {
    return { ok: false, message: RENDER_ERRORS.other, retryable: false, status: 503 };
  }
  if (!response.ok) {
    await logFailure("Fallback", response, style);
    const message = response.status === 402 ? "AI credits have run out. Add credits in Settings → Plans & credits." : renderErrorMessage(response.status);
    return { ok: false, message, retryable: false, status: response.status };
  }
  const data = await response.json().catch(() => ({})) as { data?: { b64_json?: string }[] };
  const image = data.data?.[0]?.b64_json;
  if (!image) return { ok: false, message: RENDER_ERRORS.other, retryable: false, status: 502 };
  return { ok: true, image, provider: "fallback" };
}

/** Full chain on the server (paid orders, staff): Meta, retry after 2 s, then fallback. */
export async function generateMetaPhoto(imageBase64: string, style: MetaPhotoStyle, waitMs = 2000) {
  checkPhoto(imageBase64);
  const result = await renderWithFallback(p => p === "meta" ? renderMetaOnce(imageBase64, style) : renderFallbackOnce(imageBase64, style), undefined, waitMs);
  if (result.provider === "fallback") console.warn("Photo created with fallback provider", { style });
  return result.image;
}

export function styleForIndex(styleIndex: number) {
  const style = META_STYLE_IDS.find(id => META_STYLE_INDEX[id] === styleIndex);
  if (!style) throw new Error("Unknown Christmas style.");
  return style;
}

export async function generateChristmasPhoto(original: Blob, styleIndex: number) {
  const style = styleForIndex(styleIndex);
  if (!original.size || original.size > 10 * 1024 * 1024) throw new Error("The original photo is missing or too large.");
  const bytes = new Uint8Array(await original.arrayBuffer());
  let input = "";
  for (let i = 0; i < bytes.length; i += 0x8000) input += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const b64 = await generateMetaPhoto(`data:${original.type || "image/jpeg"};base64,${btoa(input)}`, style);
  return Uint8Array.from(atob(b64), char => char.charCodeAt(0));
}
