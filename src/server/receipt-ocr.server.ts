// Reads the payment reference number from a receipt screenshot using Lovable AI (vision).
const URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "openai/gpt-6-astra";

export function pickReference(text: string): string | null {
  const m = text.replace(/[\s-]/g, "").match(/[0-9]{8,20}/);
  return m ? m[0] : null;
}

export async function readReceiptReference(dataUrl: string): Promise<{ reference: string | null; error?: string }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { reference: null, error: "Receipt scanning is not configured." };
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL, stream: true, reasoning_effort: "low",
      messages: [{ role: "user", content: [
        { type: "text", text: "This is a GCash, Maya, GoTyme or bank transfer receipt screenshot. Reply with ONLY the transaction reference number digits (no spaces). If there is no reference number, reply NONE." },
        { type: "image_url", image_url: { url: dataUrl } },
      ] }],
    }),
  });
  if (!res.ok || !res.body) {
    console.error("receipt ocr failed", res.status);
    if (res.status === 429) return { reference: null, error: "Too many scans right now. Please type the reference number." };
    if (res.status === 402) return { reference: null, error: "Receipt scanning is unavailable. Please type the reference number." };
    return { reference: null, error: "Couldn't read the receipt. Please type the reference number." };
  }
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ""; let out = "";
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop() ?? "";
    for (const l of lines) {
      const s = l.trim(); if (!s.startsWith("data:")) continue;
      const p = s.slice(5).trim(); if (p === "[DONE]") continue;
      try { out += JSON.parse(p).choices?.[0]?.delta?.content ?? ""; } catch { /* partial */ }
    }
  }
  return { reference: pickReference(out) };
}
