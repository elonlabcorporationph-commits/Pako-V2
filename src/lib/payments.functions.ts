import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const submitPaymentInput = z.object({
  customerName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(24),
  email: z.string().trim().email().max(255),
  packageId: z.enum(["basic", "premium"]),
  paymentMethod: z.enum(["bank", "gcash_qr"]),
  referenceNumber: z.string().trim().min(4).max(60),
  amount: z.number().finite().positive().max(100_000),
  senderName: z.string().trim().min(2).max(100),
  proof: z.string().max(12_000_000),
});

export const submitManualPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitPaymentInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getSettings, decodeDataUrl, ORDER_BUCKET } = await import("@/server/storage.server");
    const settings = await getSettings();
    const method = data.paymentMethod === "bank" ? "bank" : "gcash";
    if (!settings.payment[method]) throw new Error("Payment instructions are not available yet.");
    const { bytes, type } = decodeDataUrl(data.proof);
    if (!["image/jpeg", "image/png"].includes(type) || bytes.length > 8 * 1024 * 1024) throw new Error("Choose a JPG or PNG payment screenshot up to 8 MB.");
    const path = `payments/${crypto.randomUUID()}.${type === "image/png" ? "png" : "jpg"}`;
    const { error: uploadError } = await supabaseAdmin.storage.from(ORDER_BUCKET).upload(path, bytes, { contentType: type });
    if (uploadError) throw new Error("The payment screenshot could not be saved.");
    const { error } = await supabaseAdmin.from("payments").insert({
      customer_name: data.customerName,
      phone: data.phone,
      email: data.email,
      package_name: data.packageId === "basic" ? "Basic Magic" : "Magic with Music",
      payment_method: data.paymentMethod,
      amount: data.amount,
      reference_number: data.referenceNumber,
      sender_name: data.senderName,
      proof_image_url: path,
    });
    if (error) {
      await supabaseAdmin.storage.from(ORDER_BUCKET).remove([path]);
      throw new Error("The payment submission could not be saved.");
    }
    return { ok: true };
  });