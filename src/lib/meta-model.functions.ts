import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Staff-only so visitors cannot spend the owner's Meta API quota.
export const staffAskMetaModel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10).max(500), prompt: z.string().min(1).max(4000) }).parse(input))
  .handler(async ({ data }) => {
    const { requireStaffToken } = await import("@/lib/staff-auth.server");
    await requireStaffToken(data.token);
    const { callMetaModel } = await import("@/server/meta-model.server");
    return { reply: await callMetaModel(data.prompt) };
  });

export const staffGenerateMetaImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    token: z.string().min(10).max(500),
    prompt: z.string().trim().min(1, "Please describe your image.").max(4000),
    size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    const { requireStaffToken } = await import("@/lib/staff-auth.server");
    await requireStaffToken(data.token);
    const { generateMetaImage } = await import("@/server/meta-model.server");
    return { image: await generateMetaImage(data.prompt, data.size) };
  });
