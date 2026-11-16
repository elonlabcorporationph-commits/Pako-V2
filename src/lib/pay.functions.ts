import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const PAY_PACKAGES = [
  { id: "basic", name: "Basic Magic", amount: 99 },
  { id: "premium", name: "Magic with Music", amount: 149 },
] as const;

const tokenSchema = z.string().regex(/^\d+\.[0-9a-f]{64}$/);
const statusSchema = z.enum(["pending", "verified", "rejected"]);

// Helper to get the Neon DB
async function admin() {
  const { neonAdmin } = await import("@/integrations/neon/client.server");
  return neonAdmin;
}
// Helper for staff auth
async function staff(token: string) {
  const { requireStaffToken } = await import("@/lib/staff-auth.server");
  await requireStaffToken(token);
  return admin();
}
// Helper for signing storage URLs
async function sign(paths: string[], seconds: number) {
  const { signPaths, MEDIA_BUCKET } = await import("@/server/storage.server");
  return signPaths(MEDIA_BUCKET, paths, seconds);
}

export const listPayMethods = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = await admin();
    const { data, error } = await db
      .from("pay_methods")
      .select("method,label,account_name,account_number,qr_path,active")
      .eq("active", true)
      .order("sort");
    
    if (error) {
      console.error("Failed to load payment methods from DB, returning empty list:", error);
      return [];
    }

    const urls = await sign(
      (data ?? []).map((m: any) => m.qr_path ?? ""),
      3600,
    );
    return (data ?? []).map(({ qr_path, ...m }: any) => ({ ...m, qr_url: qr_path ? (urls[qr_path] ?? null) : null }));
  } catch (e) {
    console.error("Critical error in listPayMethods, returning empty list:", e);
    return [];
  }
});

export const createPayOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      packageId: z.enum(["basic", "premium"]),
      method: z.string().min(1).max(20),
      name: z.string().trim().min(2).max(60),
      contact: z.string().trim().min(7).max(80),
      email: z.string().trim().email().max(120).optional().or(z.literal("")),
      reference: z
        .string()
        .trim()
        .regex(/^[0-9]{8,20}$/, "Reference must be 8-20 digits."),
      proofs: z
        .array(z.string().max(7_500_000))
        .min(1, "Please attach your receipt.")
        .max(4, "Up to 4 receipt images."),
      photo: z.string().min(100, "Please upload your portrait first.").max(14_000_000),
      template: z.string().trim().max(30).optional(),
    })
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); // For Storage ONLY
    const { decodeDataUrl, MEDIA_BUCKET, ORDER_BUCKET } = await import("@/server/storage.server");
    
    const portrait = decodeDataUrl(data.photo);
    if (!["image/jpeg", "image/png", "image/webp"].includes(portrait.type) || portrait.bytes.length > 10 * 1024 * 1024)
      throw new Error("Your portrait must be a JPG, PNG or WEBP up to 10 MB.");
    const pkg = PAY_PACKAGES.find((p) => p.id === data.packageId)!;
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const { isRateLimited } = await import("@/lib/pay-rate-limit");
    const ip =
      getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`pasko-pay:${ip}`));
    const ipHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    
    // 1. Check rate limit in Neon
    const { data: recent } = await db
      .from("pay_orders")
      .select("created_at")
      .eq("ip_hash", ipHash)
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
    if (isRateLimited((recent ?? []).map((r: any) => new Date(r.created_at).getTime())))
      throw new Error("Too many orders from this device. Please wait a few minutes and try again.");
      
    // 2. Check method in Neon
    const { data: method } = await db
      .from("pay_methods")
      .select("method")
      .eq("method", data.method)
      .eq("active", true)
      .maybeSingle();
    if (!method) throw new Error("That payment method is not available.");
    
    const decoded = data.proofs.map((proof) => {
      const { bytes, type } = decodeDataUrl(proof);
      const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[type];
      if (!ext || bytes.length > 5 * 1024 * 1024)
        throw new Error("Each receipt must be a JPG, PNG or WEBP up to 5 MB.");
      return { bytes, type, ext };
    });
    
    const code = "PPM-" + crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    const accessToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const photoPath = `pay/${code}/original.${portrait.type === "image/png" ? "png" : portrait.type === "image/webp" ? "webp" : "jpg"}`;
    
    // 3. Upload Portrait to Supabase Storage
    const { error: photoErr } = await supabaseAdmin.storage
      .from(ORDER_BUCKET)
      .upload(photoPath, portrait.bytes, { contentType: portrait.type });
    if (photoErr) throw new Error("Your portrait could not be uploaded.");
    
    const contact = data.email ? `${data.contact} · ${data.email}` : data.contact;
    
    // 4. Insert order into Neon
    const { data: order, error } = await db
      .from("pay_orders")
      .insert({
        code,
        package_name: pkg.name,
        amount: pkg.amount,
        method: data.method,
        customer_name: data.name,
        contact,
        reference: data.reference,
        ip_hash: ipHash,
        photo_path: photoPath,
        template: data.template || null,
        access_token: accessToken,
      })
      .select("id")
      .single();
      
    if (error)
      throw new Error(
        error.code === "23505" ? "That reference number was already used." : "Your order could not be saved.",
      );
      
    const paths: string[] = [];
    for (const [i, d] of decoded.entries()) {
      const path = `proofs/${code}/receipt-${i + 1}.${d.ext}`;
      // 5. Upload receipts to Supabase Storage
      const { error: upErr } = await supabaseAdmin.storage.from(MEDIA_BUCKET).upload(path, d.bytes, { contentType: d.type });
      if (upErr) {
        await db.from("pay_orders").delete().eq("id", order.id);
        throw new Error("The receipt could not be uploaded.");
      }
      paths.push(path);
    }
    
    // 6. Update receipts in Neon
    await db
      .from("pay_orders")
      .update({ proof_path: paths[0] ?? null, proof_paths: paths })
      .eq("id", order.id)
      .is("proof_path", null);
    return { code, token: accessToken };
  });

export const scanReceiptReference = createServerFn({ method: "POST" })
  .validator(
    z.object({
      image: z
        .string()
        .min(100)
        .max(7_500_000)
        .regex(/^data:image\/(jpeg|png|webp);base64,.+$/),
    })
  )
  .handler(async ({ data }) => {
    const { readReceiptReference } = await import("@/server/receipt-ocr.server");
    return readReceiptReference(data.image);
  });

export const getPayOrderStatus = createServerFn({ method: "POST" })
  .validator(z.object({ code: z.string().trim().min(4).max(20), token: z.string().max(80).optional() }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row } = await db
      .from("pay_orders")
      .select("code,package_name,amount,status,note,created_at,render_status,result_paths,access_token")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (!row) return null;
    const { access_token, result_paths, ...order } = row;
    const owner = Boolean(data.token && access_token && data.token === access_token);
    let photos: string[] = [];
    if (owner && result_paths.some(Boolean)) {
      const { signPaths, ORDER_BUCKET } = await import("@/server/storage.server");
      const urls = await signPaths(ORDER_BUCKET, result_paths.filter(Boolean), 3600);
      photos = result_paths.map((p: string) => (p ? (urls[p] ?? "") : "")).filter(Boolean);
    }
    return { ...order, owner, photos };
  });

async function renderPayOrderById(id: string) {
  const db = await admin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); // For Storage
  
  const { data: order } = await db
    .from("pay_orders")
    .select("id,code,status,photo_path,result_paths,render_status")
    .eq("id", id)
    .maybeSingle();
  if (!order || order.status !== "verified") return { started: false };
  if (!order.photo_path) return { started: false };
  
  const claim = await db
    .from("pay_orders")
    .update({ render_status: "processing" })
    .eq("id", order.id)
    .in("render_status", ["queued", "failed"])
    .select("id");
  if (!claim.data) return { started: false };
  
  const { ORDER_BUCKET } = await import("@/server/storage.server");
  const { generateChristmasPhoto } = await import("@/server/ai.server");
  const { STYLES } = await import("@/lib/pasko-content");
  
  // Download from Supabase Storage
  const { data: original } = await supabaseAdmin.storage.from(ORDER_BUCKET).download(order.photo_path);
  if (!original) {
    await db.from("pay_orders").update({ render_status: "failed" }).eq("id", order.id);
    return { started: false };
  }
  
  const paths = Array.from({ length: 5 }, (_, i) => order.result_paths[i] || "");
  await Promise.allSettled(
    paths.map(async (existing, i) => {
      if (existing) return;
      try {
        const png = await generateChristmasPhoto(original, i);
        const path = `pay/${order.code}/result-${i + 1}-${STYLES[i]?.key ?? i}.png`;
        // Upload result to Supabase Storage
        const up = await supabaseAdmin.storage.from(ORDER_BUCKET).upload(path, png, { contentType: "image/png", upsert: true });
        if (!up.error) paths[i] = path;
      } catch (e) {
        console.error("pay render failed", {
          code: order.code,
          style: i,
          error: e instanceof Error ? e.message : "unknown",
        });
      }
    }),
  );
  
  const done = paths.every(Boolean);
  // Save paths to Neon
  await db
    .from("pay_orders")
    .update({ result_paths: paths, render_status: done ? "done" : "failed" })
    .eq("id", order.id);
  return { started: true, done };
}

export const renderPayOrder = createServerFn({ method: "POST" })
  .validator(z.object({ code: z.string().trim().min(4).max(20), token: z.string().min(20).max(80) }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: order } = await db
      .from("pay_orders")
      .select("id,code,status,photo_path,result_paths,access_token,render_status")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (!order || order.access_token !== data.token) throw new Error("Order not found.");
    if (order.status !== "verified") throw new Error("Payment is not verified yet.");
    if (!order.photo_path) throw new Error("This order has no portrait attached.");
    return renderPayOrderById(order.id);
  });

export const staffPayOrders = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: tokenSchema,
      status: z.union([statusSchema, z.literal("all")]),
      search: z.string().max(60).optional(),
    })
  )
  .handler(async ({ data }) => {
    const db = await staff(data.token);
    let q = db
      .from("pay_orders")
      .select("*")
      .order("created_at", { ascending: data.status === "pending" })
      .limit(300);
    if (data.status !== "all") q = q.eq("status", data.status);
    const s = data.search?.replace(/[%,()]/g, "").trim();
    if (s) q = q.or(`code.ilike.%${s}%,customer_name.ilike.%${s}%,reference.ilike.%${s}%`);
    const { data: orders, error } = await q;
    if (error) throw new Error("Orders could not be loaded.");
    return (orders ?? []).map(({ photo_path: _p, result_paths: _r, access_token: _a, ...o }: any) => o);
  });

export const staffPayOrderDetail = createServerFn({ method: "POST" })
  .validator(z.object({ token: tokenSchema, id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const db = await staff(data.token);
    const { data: found } = await db.from("pay_orders").select("*").eq("id", data.id).maybeSingle();
    if (!found) throw new Error("Order not found.");
    const { photo_path: _p, result_paths: _r, access_token: _a, ...order } = found;
    const [{ data: events }, { data: method }, { data: near }] = await Promise.all([
      db.from("pay_order_events").select("*").eq("order_id", order.id).order("created_at"),
      db
        .from("pay_methods")
        .select("label,qr_path,account_name,account_number")
        .eq("method", order.method)
        .maybeSingle(),
      db
        .from("pay_orders")
        .select("code")
        .eq("amount", order.amount)
        .neq("id", order.id)
        .gte("created_at", new Date(new Date(order.created_at).getTime() - 5 * 60_000).toISOString())
        .lte("created_at", new Date(new Date(order.created_at).getTime() + 5 * 60_000).toISOString()),
    ]);
    const proofPaths = order.proof_paths?.length ? order.proof_paths : order.proof_path ? [order.proof_path] : [];
    const urls = await sign([...proofPaths, method?.qr_path ?? ""], 60);
    return {
      order,
      events: events ?? [],
      method,
      proofUrls: proofPaths.map((p: string) => urls[p]).filter((u): u is string => Boolean(u)),
      qrUrl: method?.qr_path ? (urls[method.qr_path] ?? null) : null,
      similar: (near ?? []).map((n: any) => n.code),
    };
  });

export const staffReviewPayOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: tokenSchema,
      id: z.string().uuid(),
      status: z.enum(["verified", "rejected"]),
      note: z.string().trim().max(300).optional(),
    })
  )
  .handler(async ({ data }) => {
    if (data.status === "rejected" && !data.note) throw new Error("Please give a reason for rejecting.");
    const db = await staff(data.token);
    const { data: rows, error } = await db
      .from("pay_orders")
      .update({
        status: data.status,
        note: data.note || null,
        reviewed_at: new Date().toISOString(),
        ...(data.status === "verified" ? { render_status: "queued" } : {}),
      })
      .eq("id", data.id)
      .eq("status", "pending")
      .select("id");
    if (error) throw new Error("The review could not be saved.");
    if (!rows) throw new Error("This order is no longer pending.");
    
    await db
      .from("pay_order_events")
      .insert({ order_id: data.id, from_status: "pending", to_status: data.status, note: data.note || null });
      
    if (data.status === "verified") {
      const result = await renderPayOrderById(data.id).catch((e) => {
        console.error("pay render failed", { id: data.id, error: e instanceof Error ? e.message : "unknown" });
        return { started: false, done: false };
      });
      return { ok: true, rendered: Boolean((result as { done?: boolean }).done) };
    }
    return { ok: true, rendered: false };
  });

export const staffReopenPayOrder = createServerFn({ method: "POST" })
  .validator(z.object({ token: tokenSchema, id: z.string().uuid(), note: z.string().trim().max(300).optional() }))
  .handler(async ({ data }) => {
    const db = await staff(data.token);
    const { data: order } = await db.from("pay_orders").select("status").eq("id", data.id).maybeSingle();
    if (!order) throw new Error("Order not found.");
    
    await db.from("pay_orders").update({ status: "pending", reviewed_at: null }).eq("id", data.id);
    await db
      .from("pay_order_events")
      .insert({ order_id: data.id, from_status: order.status, to_status: "pending", note: data.note || "Reopened" });
    return { ok: true };
  });

export const staffListPayMethods = createServerFn({ method: "POST" })
  .validator(z.object({ token: tokenSchema }))
  .handler(async ({ data }) => {
    const db = await staff(data.token);
    const { data: rows } = await db.from("pay_methods").select("*").order("sort");
    const urls = await sign(
      (rows ?? []).map((m: any) => m.qr_path ?? ""),
      600,
    );
    return (rows ?? []).map((m: any) => ({ ...m, qr_url: m.qr_path ? (urls[m.qr_path] ?? null) : null }));
  });

export const staffSavePayMethod = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: tokenSchema,
      method: z.string().min(1).max(20),
      account_name: z.string().trim().max(100),
      account_number: z.string().trim().max(60),
      active: z.boolean(),
      qr: z.string().max(7_500_000).optional(),
    })
  )
  .handler(async ({ data }) => {
    const db = await staff(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); // For Storage
    
    const changes: { account_name: string; account_number: string; active: boolean; qr_path?: string } = {
      account_name: data.account_name,
      account_number: data.account_number,
      active: data.active,
    };
    
    if (data.qr) {
      const { decodeDataUrl, MEDIA_BUCKET } = await import("@/server/storage.server");
      const { bytes, type } = decodeDataUrl(data.qr);
      if (!["image/jpeg", "image/png", "image/webp"].includes(type) || bytes.length > 5 * 1024 * 1024)
        throw new Error("QR must be a JPG, PNG or WEBP up to 5 MB.");
      const path = `qr/${data.method}-${Date.now()}.${type.split("/")[1]}`;
      // Upload to Supabase
      const { error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: type });
      if (error) throw new Error("The QR image could not be uploaded.");
      changes.qr_path = path;
    }
    
    // Save to Neon
    const { error } = await db.from("pay_methods").update(changes).eq("method", data.method);
    if (error) throw new Error("The payment method could not be saved.");
    return { ok: true };
  });

export const staffPaySummary = createServerFn({ method: "POST" })
  .validator(z.object({ token: tokenSchema }))
  .handler(async ({ data }) => {
    const db = await staff(data.token);
    const { data: rows, error } = await db.from("pay_orders").select("status,amount,created_at,render_status").limit(5000);
    if (error) throw new Error("Summary could not be loaded.");
    
    const start = new Date(); start.setUTCHours(start.getUTCHours() + 8); start.setUTCHours(0, 0, 0, 0); start.setUTCHours(start.getUTCHours() - 8);
    const s = { todayOrders: 0, todayIncome: 0, totalIncome: 0, totalOrders: 0, pending: 0, rendering: 0, renderFailed: 0, done: 0 };
    for (const r of rows ?? []) {
      const today = new Date(r.created_at) >= start;
      s.totalOrders++; if (today) s.todayOrders++;
      if (r.status === "pending") s.pending++;
      if (r.status === "verified") {
        s.totalIncome += r.amount; if (today) s.todayIncome += r.amount;
        if (r.render_status === "done") s.done++;
        else if (r.render_status === "failed") s.renderFailed++;
        else s.rendering++;
      }
    }
    return s;
  });

export const staffRerenderPayOrder = createServerFn({ method: "POST" })
  .validator(z.object({ token: tokenSchema, id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const db = await staff(data.token);
    const { data: rows } = await db
      .from("pay_orders")
      .update({ render_status: "queued" })
      .eq("id", data.id)
      .eq("status", "verified")
      .neq("render_status", "done")
      .select("id");
    if (!rows) throw new Error("This order is not waiting for photos.");
    const r = await renderPayOrderById(data.id);
    return { done: Boolean((r as { done?: boolean }).done) };
  });