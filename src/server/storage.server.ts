import { neonAdmin } from "@/integrations/neon/client.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ORDER_BUCKET = "pasko-orders";
export const MEDIA_BUCKET = "pasko-media";

export function decodeDataUrl(dataUrl: string) {
  const match = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match?.[1] || !match[2]) throw new Error("Invalid photo data.");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, type: match[1] };
}

export async function signPaths(bucket: string, paths: string[], seconds = 3600) {
  const validPaths = paths.filter(Boolean);
  if (!validPaths.length) return {} as Record<string, string>;
  
  // Still use Supabase for file storage
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrls(validPaths, seconds);
  if (error) throw new Error("Could not prepare private photo links.");
  
  const signed: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) signed[entry.path] = entry.signedUrl;
  }
  return signed;
}

export async function getSettings() {
  // Use Neon for database
  const { data } = await neonAdmin.from("app_settings").select("key, value");
  const rows = Object.fromEntries((data ?? []).map((row: any) => [row.key, row.value]));
  const pricing = rows["pricing"] as { basic?: number; premium?: number } | undefined;
  const payment = rows["payment"] as { gcash?: string; maya?: string; bank?: string } | undefined;
  return {
    pricing: {
      basic: Number(pricing?.basic) > 0 ? Number(pricing?.basic) : 99,
      premium: Number(pricing?.premium) > 0 ? Number(pricing?.premium) : 149,
    },
    payment: {
      gcash: payment?.gcash ?? "",
      maya: payment?.maya ?? "",
      bank: payment?.bank ?? "",
    },
    retentionDays: Math.max(1, Math.min(365, Number(rows["retention_days"] ?? 30))),
  };
}

export async function cleanupExpiredOrders() {
  // Get expired orders from Neon
  const { data: expired } = await neonAdmin
    .from("orders")
    .select("id, original_path, result_paths")
    .lt("expires_at", new Date().toISOString())
    .limit(200);
    
  if (!expired?.length) return 0;
  
  // Remove files from Supabase Storage
  const paths = expired.flatMap((order: any) => [order.original_path, ...(order.result_paths || [])]).filter(Boolean);
  if (paths.length) await supabaseAdmin.storage.from(ORDER_BUCKET).remove(paths);
  
  // Remove records from Neon
  await neonAdmin.from("orders").delete().in("id", expired.map((order: any) => order.id));
  return expired.length;
}