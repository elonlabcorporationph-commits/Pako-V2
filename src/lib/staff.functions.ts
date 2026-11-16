import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { neonAdmin } from "@/integrations/neon/client.server";

const tokenSchema = z.string().regex(/^\d+\.[0-9a-f]{64}$/);
const pinSchema = z.string().trim().regex(/^\d{4,8}$/);

const STAFF_STATUSES = ["all", "pending_payment", "pending_verification", "payment_verified", "processing", "completed", "rejected", "failed"] as const;

// Auth check only. Supabase is kept ONLY for storage.
async function staffContext(token: string) {
  const { requireStaffToken } = await import("@/lib/staff-auth.server");
  await requireStaffToken(token);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const staffPinLogin = createServerFn({ method: "POST" })
  .validator(z.object({ pin: pinSchema }))
  .handler(async ({ data }) => {
    const { verifyStaffPin } = await import("@/lib/staff-auth.server");
    const token = await verifyStaffPin(data.pin);
    if (!token) throw new Error("Wrong PIN. Please try again.");
    return { token };
  });

export const staffListOrders = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: tokenSchema,
      status: z.enum(STAFF_STATUSES).default("all"),
      search: z.string().max(100).optional(),
    })
  )
  .handler(async ({ data }) => {
    await staffContext(data.token); // Auth check
    const { signPaths, ORDER_BUCKET } = await import("@/server/storage.server");
    
    let query = neonAdmin
      .from("orders")
      .select("id, reference, full_name, mobile, email, package, template, amount, payment_method, payment_reference, payment_screenshot_path, status, payment_verified_at, result_paths, created_at, expires_at, admin_note, company")
      .order("created_at", { ascending: false })
      .limit(250);
      
    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.search) {
      const text = data.search.replace(/[%,()]/g, "");
      if (text) query = query.or(`reference.ilike.%${text}%,full_name.ilike.%${text}%,mobile.ilike.%${text}%,payment_reference.ilike.%${text}%`);
    }
    
    const { data: orders, error } = await query;
    if (error) throw new Error("Orders could not be loaded.");
    
    const shots = await signPaths(ORDER_BUCKET, (orders ?? []).map((order: any) => order.payment_screenshot_path ?? "").filter(Boolean));
    const list = (orders ?? []).map((order: any) => ({ ...order, screenshot_url: order.payment_screenshot_path ? shots[order.payment_screenshot_path] ?? null : null }));
    const paid = list.filter((order: any) => ["payment_verified", "processing", "completed"].includes(order.status));
    
    return {
      orders: list,
      stats: {
        total: list.length,
        pendingVerification: list.filter((order: any) => order.status === "pending_verification").length,
        waiting: list.filter((order: any) => order.status === "pending_payment").length,
        paid: paid.reduce((sum: number, order: any) => sum + order.amount, 0),
        completed: list.filter((order: any) => order.status === "completed").length,
      },
    };
  });

export const staffReviewOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: tokenSchema,
      id: z.string().uuid(),
      approved: z.boolean(),
      reason: z.string().trim().max(300).optional(),
    })
  )
  .handler(async ({ data }) => {
    await staffContext(data.token);
    const now = new Date().toISOString();
    const changes = data.approved
      ? { status: "payment_verified" as const, payment_verified_at: now, updated_at: now, admin_note: null }
      : { status: "rejected" as const, payment_verified_at: null, updated_at: now, admin_note: data.reason || "Payment could not be verified." };
      
    const { error } = await neonAdmin.from("orders").update(changes).eq("id", data.id).in("status", ["pending_verification", "pending_payment", "rejected"]);
    if (error) throw new Error("The review could not be saved.");
    return { ok: true };
  });

export const staffGeneratePhoto = createServerFn({ method: "POST" })
  .validator(z.object({ token: tokenSchema, id: z.string().uuid(), index: z.number().int().min(0).max(4) }))
  .handler(async ({ data }) => {
    const supabaseAdmin = await staffContext(data.token); // Get Supabase for Storage
    const { ORDER_BUCKET } = await import("@/server/storage.server");
    const { generateChristmasPhoto } = await import("@/server/ai.server");
    const { canGenerateOrder } = await import("@/lib/order-policy");
    
    // 1. Fetch from Neon
    const { data: order } = await neonAdmin.from("orders").select("id, reference, status, payment_verified_at, original_path, result_paths").eq("id", data.id).maybeSingle();
    if (!order) throw new Error("Order not found.");
    if (!canGenerateOrder(order.status, order.payment_verified_at)) throw new Error("Approve the payment before creating photos.");

    // 2. Update status in Neon
    await neonAdmin.from("orders").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", order.id);
    
    try {
      // 3. Download from Supabase
      const { data: original, error: downloadError } = await supabaseAdmin.storage.from(ORDER_BUCKET).download(order.original_path);
      if (downloadError || !original) throw new Error("The original photo is no longer available.");
      
      const image = await generateChristmasPhoto(original, data.index);
      const { STYLES } = await import("@/lib/pasko-content");
      const style = STYLES[data.index];
      if (!style) throw new Error("Unknown Christmas style.");
      
      // 4. Upload to Supabase
      const path = `results/${order.reference}/${data.index + 1}-${style.key}.png`;
      const { error: uploadError } = await supabaseAdmin.storage.from(ORDER_BUCKET).upload(path, image, { contentType: "image/png", upsert: true });
      if (uploadError) throw new Error("The new photo could not be saved.");
      
      const nextPaths = [...(order.result_paths || [])];
      while (nextPaths.length < 5) nextPaths.push("");
      nextPaths[data.index] = path;
      const complete = nextPaths.every(Boolean);
      
      // 5. Save to Neon
      const { error: saveError } = await neonAdmin.from("orders").update({ result_paths: nextPaths, status: complete ? "completed" : "processing", updated_at: new Date().toISOString(), admin_note: null }).eq("id", order.id);
      if (saveError) throw new Error("The photo result could not be attached to the order.");
      return { ok: true, complete };
    } catch (error) {
      // 6. Fail state in Neon
      await neonAdmin.from("orders").update({ status: "failed", admin_note: error instanceof Error ? error.message.slice(0, 350) : "Photo generation failed", updated_at: new Date().toISOString() }).eq("id", order.id);
      throw error instanceof Error ? error : new Error("Photo generation failed.");
    }
  });

export const staffGetSettings = createServerFn({ method: "POST" })
  .validator(z.object({ token: tokenSchema }))
  .handler(async ({ data }) => {
    await staffContext(data.token);
    const { getSettings } = await import("@/server/storage.server");
    return getSettings();
  });

export const staffSaveSettings = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: tokenSchema,
      pricing: z.object({ basic: z.number().int().min(1).max(100_000), premium: z.number().int().min(1).max(100_000) }),
      payment: z.object({ gcash: z.string().trim().max(200), maya: z.string().trim().max(200), bank: z.string().trim().max(200) }),
      retentionDays: z.number().int().min(1).max(365),
    })
  )
  .handler(async ({ data }) => {
    await staffContext(data.token);
    const now = new Date().toISOString();
    
    // Save settings to Neon
    const { error } = await neonAdmin.from("app_settings").upsert([
      { key: "pricing", value: data.pricing, updated_at: now },
      { key: "payment", value: data.payment, updated_at: now },
      { key: "retention_days", value: data.retentionDays, updated_at: now },
    ]);
    if (error) throw new Error("Studio settings could not be saved.");
    return { ok: true };
  });