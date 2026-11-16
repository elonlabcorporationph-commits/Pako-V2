import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { META_STYLE_IDS } from "@/lib/meta-photo-styles";

// Owner-requested public demo; one provider attempt per call so the browser can show Retrying / Using fallback.
export const generatePaskoPhotos = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ imageBase64: z.string().min(1).max(14_000_000), style: z.enum(META_STYLE_IDS), provider: z.enum(["meta", "fallback"]).default("meta") }).parse(input))
  .handler(async ({ data }) => {
    const { renderMetaOnce, renderFallbackOnce } = await import("@/server/ai.server");
    return data.provider === "meta" ? renderMetaOnce(data.imageBase64, data.style) : renderFallbackOnce(data.imageBase64, data.style);
  });

export const generatePaidPaskoPhotos = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ reference: z.string().min(8).max(40), token: z.string().uuid(), indices: z.array(z.number().int().min(0).max(4)).min(1).max(5) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { canGenerateOrder } = await import("@/lib/order-policy");
    const { data: order } = await supabaseAdmin.from("orders").select("id, reference, access_token, expires_at, status, payment_verified_at, original_path, result_paths").eq("reference", data.reference).maybeSingle();
    if (!order || order.access_token !== data.token || Date.parse(order.expires_at) <= Date.now()) throw new Error("Order not found or expired.");
    if (!canGenerateOrder(order.status, order.payment_verified_at)) throw new Error("Payment must be verified before creating photos.");
    const { renderPaidPhotoBatch } = await import("@/server/paid-photos.server");
    return renderPaidPhotoBatch(order, data.indices);
  });
