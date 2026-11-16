// Calls Meta's Llama API (OpenAI-compatible chat endpoint). Server-only: the key never reaches the browser.
const LLAMA_URL = "https://api.llama.com/compat/v1/chat/completions";
const DEFAULT_MODEL = "Llama-4-Maverick-17B-128E-Instruct-FP8";

export async function callMetaModel(prompt: string, model = DEFAULT_MODEL) {
  const apiKey = process.env["MODEL_API_KEY"];
  if (!apiKey) throw new Error("The Meta model key is not set up yet.");
  const response = await fetch(LLAMA_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Meta model failed [${response.status}]: ${text}`);
    throw new Error(`Meta model request failed (${response.status}).`);
  }
  const json = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

const META_IMAGE_URL = "https://api.meta.ai/v1/images/generations";
export const META_IMAGE_SIZES = ["1024x1024", "1024x1536", "1536x1024"] as const;

// Generates one PNG with Meta's image model. Returns base64; never logs or returns the key.
export async function generateMetaImage(prompt: string, size: (typeof META_IMAGE_SIZES)[number] = "1024x1024") {
  const apiKey = process.env["MODEL_API_KEY"];
  if (!apiKey) throw new Error("The Meta model key is not set up yet.");
  const response = await fetch(META_IMAGE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "muse-image-1.0", prompt, size, n: 1, output_format: "png" }),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Meta image failed [${response.status}]: ${text.slice(0, 500)}`);
    let message = "";
    try { message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? ""; } catch { /* not json */ }
    throw new Error(message ? `Meta image failed: ${message}` : `Meta image request failed (${response.status}).`);
  }
  const data = JSON.parse(text) as { data?: { b64_json?: string }[] };
  const image = data.data?.[0]?.b64_json;
  if (!image) throw new Error("Meta returned no image.");
  return image;
}
