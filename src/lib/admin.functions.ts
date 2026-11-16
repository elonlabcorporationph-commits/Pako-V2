import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canGenerateOrder } from "@/lib/order-policy";
import { neonAdmin } from "@/integrations/neon/client.server";

async function requireAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Staff access is required.");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: data === true };
  });

export const listOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ search: z.string().max(100).optional(), status: z.enum(["all", "pending_payment", "payment_verified", "processing", "completed", "failed"]).default("all") }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    let query = neonAdmin.from("orders").select("id, reference, full_name, mobile, email, package, template, amount, payment_method, payment_reference, status, payment_verified_at, result_paths, created_at, expires_at, admin_note").order("created_at", { ascending: false }).limit(250);
    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.search) {
      const text = data.search.replace(/[%,()]/g, "");
      if (text) query = query.or(`reference.ilike.%${text}%,full_name.ilike.%${text}%,mobile.ilike.%${text}%,email.ilike.%${text}%`);
    }
    const { data: orders, error } = await query;
    if (error) throw new Error("Orders could not be loaded.");
    const paid = (orders ?? []).filter((order: any) => ["payment_verified", "processing", "completed"].includes(order.status));
    return {
      orders: orders ?? [],
      stats: {
        total: orders?.length ?? 0,
        paid: paid.reduce((sum: number, order: any) => sum + order.amount, 0),
        waiting: (orders ?? []).filter((order: any) => order.status === "pending_payment").length,
        completed: (orders ?? []).filter((order: any) => order.status === "completed").length,
      },
    };
  });

export const updateOrderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid(), verified: z.boolean() }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const changes = data.verified
      ? { status: "payment_verified" as const, payment_verified_at: new Date().toISOString(), updated_at: new Date().toISOString(), admin_note: null }
      : { status: "pending_payment" as const, payment_verified_at: null, updated_at: new Date().toISOString() };
    const { error } = await neonAdmin.from("orders").update(changes).eq("id", data.id);
    if (error) throw new Error("The payment status could not be updated.");
    return { ok: true };
  });

export const generateOrderPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid(), index: z.number().int().min(0).max(4) }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ORDER_BUCKET } = await import("@/server/storage.server");
    const { generateChristmasPhoto } = await import("@/server/ai.server");
    const { data: order } = await neonAdmin.from("orders").select("id, reference, status, payment_verified_at, original_path, result_paths").eq("id", data.id).maybeSingle();
    if (!order) throw new Error("Order not found.");
    if (!canGenerateOrder(order.status, order.payment_verified_at)) throw new Error("Verify payment before creating photos.");

    await neonAdmin.from("orders").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", order.id);
    try {
      const { data: original, error: downloadError } = await supabaseAdmin.storage.from(ORDER_BUCKET).download(order.original_path);
      if (downloadError || !original) throw new Error("The original photo is no longer available.");
      const image = await generateChristmasPhoto(original, data.index);
      const { STYLES } = await import("@/lib/pasko-content");
      const style = STYLES[data.index];
      if (!style) throw new Error("Unknown Christmas style.");
      const path = `results/${order.reference}/${data.index + 1}-${style.key}.png`;
      const { error: uploadError } = await supabaseAdmin.storage.from(ORDER_BUCKET).upload(path, image, { contentType: "image/png", upsert: true });
      if (uploadError) throw new Error("The new photo could not be saved.");
      const nextPaths = [...(order.result_paths || [])];
      while (nextPaths.length < 5) nextPaths.push("");
      nextPaths[data.index] = path;
      const complete = nextPaths.every(Boolean);
      const { error: saveError } = await neonAdmin.from("orders").update({ result_paths: nextPaths, status: complete ? "completed" : "processing", updated_at: new Date().toISOString(), admin_note: null }).eq("id", order.id);
      if (saveError) throw new Error("The photo result could not be attached to the order.");
      return { ok: true, complete };
    } catch (error) {
      await neonAdmin.from("orders").update({ status: "failed", admin_note: error instanceof Error ? error.message.slice(0, 350) : "Photo generation failed", updated_at: new Date().toISOString() }).eq("id", order.id);
      throw error instanceof Error ? error : new Error("Photo generation failed.");
    }
  });

export const getAdminSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await neonAdmin.from("app_settings").select("key, value");
    if (error) throw new Error("Studio settings could not be loaded.");
    const values = Object.fromEntries((data ?? []).map((row: any) => [row.key, row.value]));
    return {
      pricing: (values["pricing"] as { basic?: number; premium?: number } | undefined) ?? { basic: 99, premium: 149 },
      payment: (values["payment"] as { gcash?: string; maya?: string; bank?: string } | undefined) ?? { gcash: "", maya: "", bank: "" },
      retentionDays: Number(values["retention_days"] ?? 30),
    };
  });

export const saveAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    pricing: z.object({ basic: z.number().int().min(1).max(100_000), premium: z.number().int().min(1).max(100_000) }),
    payment: z.object({ gcash: z.string().trim().max(200), maya: z.string().trim().max(200), bank: z.string().trim().max(200) }),
    retentionDays: z.number().int().min(1).max(365),
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const now = new Date().toISOString();
    const { error } = await neonAdmin.from("app_settings").upsert([
      { key: "pricing", value: data.pricing, updated_at: now },
      { key: "payment", value: data.payment, updated_at: now },
      { key: "retention_days", value: data.retentionDays, updated_at: now },
    ]);
    if (error) throw new Error("Studio settings could not be saved.");
    return { ok: true };
  });

export const listManualPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signPaths, ORDER_BUCKET } = await import("@/server/storage.server");
    const { data: payments, error } = await neonAdmin.from("payments").select("id, customer_name, phone, email, package_name, payment_method, amount, reference_number, sender_name, proof_image_url, status, created_at").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error("Payment submissions could not be loaded.");
    const urls = await signPaths(ORDER_BUCKET, (payments ?? []).map((payment: any) => payment.proof_image_url));
    return (payments ?? []).map((payment: any) => ({ ...payment, proof_url: urls[payment.proof_image_url] ?? null }));
  });

export const reviewManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid(), approved: z.boolean() }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await neonAdmin.from("payments").update({ status: data.approved ? "approved" : "rejected" }).eq("id", data.id);
    if (error) throw new Error("The payment review could not be saved.");
    return { ok: true };
  });

export const testPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ photo: z.string().max(14_000_000), index: z.number().int().min(0).max(4) }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data.photo);
    if (!match?.[1] || !match[2]) throw new Error("Choose a JPG, PNG or WEBP photo.");
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const { generateChristmasPhoto } = await import("@/server/ai.server");
    const png = await generateChristmasPhoto(new Blob([bytes], { type: match[1] }), data.index);
    let out = "";
    for (let i = 0; i < png.length; i += 0x8000) out += String.fromCharCode(...png.subarray(i, i + 0x8000));
    return { image: `data:image/png;base64,${btoa(out)}` };
  });