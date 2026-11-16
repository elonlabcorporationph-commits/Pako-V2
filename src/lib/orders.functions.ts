import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { STYLES } from "@/lib/pasko-content";

const templateSchema = z.enum(["santa", "family", "winter", "lights", "fashion"]);
const referenceSchema = z.string().trim().toUpperCase().min(8).max(40);
const tokenSchema = z.string().uuid();
const lookupSchema = z.object({ reference: referenceSchema, token: tokenSchema });

const createOrderSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  mobile: z.string().trim().regex(/^\+639\d{9}$/),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  pkg: z.enum(["basic", "premium"]),
  template: templateSchema,
  paymentMethod: z.enum(["gcash", "maya", "bank"]),
  photo: z.string().max(15_000_000),
});

function makeReference() {
  const now = new Date();
  const datePart = `${String(now.getUTCFullYear()).slice(-2)}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `XM-${datePart}-${suffix}`;
}

export const createOrder = createServerFn({ method: "POST" })
  .validator(createOrderSchema)
  .handler(async ({ data }) => {
    const { neonAdmin } = await import("@/integrations/neon/client.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decodeDataUrl, getSettings, ORDER_BUCKET } = await import("@/server/storage.server");
    
    const { bytes, type } = decodeDataUrl(data.photo);
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) throw new Error("Use a JPG, PNG, or WEBP photo.");
    if (bytes.length < 10 * 1024 || bytes.length > 10 * 1024 * 1024) throw new Error("Photo must be between 10 KB and 10 MB.");

    const settings = await getSettings();
    const reference = makeReference();
    const extension = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const originalPath = `originals/${reference}.${extension}`;
    
    // 1. Upload to Supabase Storage
    const upload = await supabaseAdmin.storage.from(ORDER_BUCKET).upload(originalPath, bytes, { contentType: type });
    if (upload.error) throw new Error("Photo upload failed. Please try again.");

    // 2. Save to Neon Database
    const { data: order, error } = await neonAdmin
      .from("orders")
      .insert({
        reference,
        full_name: data.fullName,
        mobile: data.mobile,
        email: data.email || null,
        package: data.pkg,
        template: data.template,
        amount: settings.pricing[data.pkg],
        payment_method: data.paymentMethod,
        original_path: originalPath,
        expires_at: new Date(Date.now() + settings.retentionDays * 86_400_000).toISOString(),
      })
      .select("reference, access_token")
      .single();

    if (error || !order) {
      await supabaseAdmin.storage.from(ORDER_BUCKET).remove([originalPath]);
      throw new Error("We couldn't save your order. Please try again.");
    }
    return { reference: order.reference, token: order.access_token };
  });

export const getCustomerOrder = createServerFn({ method: "POST" })
  .validator(lookupSchema)
  .handler(async ({ data }) => {
    const { neonAdmin } = await import("@/integrations/neon/client.server");
    const { signPaths, getSettings, ORDER_BUCKET } = await import("@/server/storage.server");
    
    const { data: order } = await neonAdmin
      .from("orders")
      .select("*")
      .eq("reference", data.reference)
      .maybeSingle();
      
    if (!order || order.access_token !== data.token) return null;

    const signed = await signPaths(ORDER_BUCKET, [order.original_path, ...(order.result_paths || [])]);
    const settings = await getSettings();
    
    return {
      reference: order.reference,
      fullName: order.full_name,
      pkg: order.package as "basic" | "premium",
      template: order.template,
      amount: order.amount,
      paymentMethod: order.payment_method as "gcash" | "maya" | "bank",
      paymentReference: order.payment_reference,
      status: order.status,
      createdAt: order.created_at,
      expiresAt: order.expires_at,
      originalUrl: signed[order.original_path] ?? null,
      resultSlots: Array.from({ length: 5 }, (_, i) => order.result_paths?.[i] ? signed[order.result_paths[i] ?? ""] ?? null : null),
      generationError: order.status === "failed" ? "This style did not finish. Retry to create the missing photo." : null,
      results: (order.result_paths || []).map((path: string) => path ? signed[path] : null).filter((url): url is string => Boolean(url)),
      payTo: settings.payment[order.payment_method as "gcash" | "maya" | "bank"],
      paymentSettings: settings.payment,
    };
  });

export const submitPaymentReference = createServerFn({ method: "POST" })
  .validator(lookupSchema.extend({ paymentReference: z.string().trim().min(4).max(60) }))
  .handler(async ({ data }) => {
    const { neonAdmin } = await import("@/integrations/neon/client.server");
    
    const { data: order } = await neonAdmin.from("orders").select("id, access_token, status").eq("reference", data.reference).maybeSingle();
    if (!order || order.access_token !== data.token) throw new Error("Order not found.");
    if (order.status !== "pending_payment") throw new Error("This order is no longer waiting for payment.");
    
    const { error } = await neonAdmin.from("orders").update({ payment_reference: data.paymentReference, updated_at: new Date().toISOString() }).eq("id", order.id);
    if (error) throw new Error("We couldn't save the payment reference. Please try again.");
    return { ok: true };
  });

export const submitPaymentProof = createServerFn({ method: "POST" })
  .validator(
    lookupSchema.extend({
      paymentReference: z.string().trim().min(4).max(60),
      screenshot: z.string().max(12_000_000).optional(),
    })
  )
  .handler(async ({ data }) => {
    const { neonAdmin } = await import("@/integrations/neon/client.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decodeDataUrl, ORDER_BUCKET } = await import("@/server/storage.server");
    
    const { data: order } = await neonAdmin.from("orders").select("id, access_token, status").eq("reference", data.reference).maybeSingle();
    if (!order || order.access_token !== data.token) throw new Error("Order not found.");
    if (!["pending_payment", "rejected"].includes(order.status)) throw new Error("This order is no longer waiting for payment.");

    let screenshotPath: string | null = null;
    if (data.screenshot) {
      const { bytes, type } = decodeDataUrl(data.screenshot);
      if (!["image/jpeg", "image/png", "image/webp"].includes(type) || bytes.length > 8 * 1024 * 1024) throw new Error("Choose a JPG, PNG or WEBP screenshot up to 8 MB.");
      screenshotPath = `payments/${data.reference}-${crypto.randomUUID()}.${type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg"}`;
      const { error: uploadError } = await supabaseAdmin.storage.from(ORDER_BUCKET).upload(screenshotPath, bytes, { contentType: type });
      if (uploadError) throw new Error("The payment screenshot could not be saved.");
    }

    const { error } = await neonAdmin.from("orders").update({
      payment_reference: data.paymentReference,
      payment_screenshot_path: screenshotPath,
      status: "pending_verification",
      admin_note: null,
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);
    
    if (error) {
      if (screenshotPath) await supabaseAdmin.storage.from(ORDER_BUCKET).remove([screenshotPath]);
      throw new Error("We couldn't save your payment. Please try again.");
    }
    return { ok: true };
  });

export const trackOrder = createServerFn({ method: "POST" })
  .validator(z.object({ reference: referenceSchema, mobile: z.string().regex(/^\+639\d{9}$/) }))
  .handler(async ({ data }) => {
    const { neonAdmin } = await import("@/integrations/neon/client.server");
    const { data: order } = await neonAdmin.from("orders").select("reference, access_token, mobile").eq("reference", data.reference).maybeSingle();
    if (!order || order.mobile !== data.mobile) return null;
    return { reference: order.reference, token: order.access_token };
  });

export const getSiteData = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { neonAdmin } = await import("@/integrations/neon/client.server");
    const { getSettings, signPaths, MEDIA_BUCKET } = await import("@/server/storage.server");
    
    let settings = {
      pricing: { basic: 99, premium: 149 },
      payment: { gcash: "", maya: "", bank: "" },
      retentionDays: 30
    };

    try {
      const dbSettings = await getSettings();
      if (dbSettings) settings = dbSettings;
    } catch (e) {
      console.error("Failed to load settings from DB, using fallback", e);
    }

    let samples = [];
    try {
      const { data } = await neonAdmin.from("samples").select("*");
      samples = (data || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } catch (e) {
      console.error("Failed to load samples from DB", e);
    }

    const signedUrls = await signPaths(MEDIA_BUCKET, samples.map((sample: any) => sample.image_url), 86_400);
    
    return { 
      pricing: settings.pricing, 
      payment: settings.payment, 
      samples: samples.map((sample: any) => ({ 
        id: sample.id, 
        style: sample.style, 
        url: signedUrls[sample.image_url] ?? null 
      })).filter((sample: any) => sample.url) 
    };
  } catch (outerError) {
    console.error("Critical error in getSiteData:", outerError);
    return {
      pricing: { basic: 99, premium: 149 },
      payment: { gcash: "", maya: "", bank: "" },
      samples: []
    };
  }
});