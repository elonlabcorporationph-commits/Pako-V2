import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateChristmasPhoto } from "@/server/ai.server";
import { ORDER_BUCKET } from "@/server/storage.server";
import { STYLES } from "@/lib/pasko-content";

type PaidOrder = { id: string; reference: string; original_path: string; result_paths: string[] };
export async function renderPaidPhotoBatch(order: PaidOrder, indices: number[]) {
  const { data: original, error } = await supabaseAdmin.storage.from(ORDER_BUCKET).download(order.original_path);
  if (error || !original) throw new Error("The uploaded photo is no longer available.");
  // A conditional claim prevents duplicate batches on reloads or in a second tab.
  const claim = await supabaseAdmin.from("orders").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", order.id).in("status", ["payment_verified", "failed"]).select("id");
  if (claim.error) throw new Error("Photo creation could not start.");
  if (!claim.data?.length) return { errors: {} as Record<number, string> };
  const paths = Array.from({ length: 5 }, (_, i) => order.result_paths[i] || "");
  const errors: Record<number, string> = {};
  await Promise.allSettled([...new Set(indices)].filter(i => !paths[i]).map(async index => {
    try {
      const style = STYLES[index];
      if (!style) throw new Error("Unknown Christmas style.");
      const png = await generateChristmasPhoto(original, index);
      const path = `results/${order.reference}/${index + 1}-${style.key}.png`;
      const saved = await supabaseAdmin.storage.from(ORDER_BUCKET).upload(path, png, { contentType: "image/png", upsert: true });
      if (saved.error) throw new Error("Could not save this photo.");
      paths[index] = path;
    } catch (e) { errors[index] = e instanceof Error ? e.message : "Photo creation failed."; }
  }));
  const saved = await supabaseAdmin.from("orders").update({ result_paths: paths, status: paths.every(Boolean) ? "completed" : "failed", admin_note: Object.values(errors).join(" ").slice(0, 350) || null, updated_at: new Date().toISOString() }).eq("id", order.id);
  if (saved.error) throw new Error("Could not attach the photos to your order.");
  return { errors };
}
