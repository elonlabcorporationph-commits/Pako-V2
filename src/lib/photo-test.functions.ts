import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public Test Mode render requested by the owner: never creates payments or orders.
// One provider attempt per call; the browser drives retry and fallback so it can show each stage.
export const testCheckoutPhoto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ photo: z.string().max(14_000_000), index: z.number().int().min(0).max(4), provider: z.enum(["meta", "fallback"]).default("meta") }).parse(input))
  .handler(async ({ data }) => {
    if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data.photo)) throw new Error("Choose a JPG, PNG or WEBP photo.");
    const { renderMetaOnce, renderFallbackOnce, styleForIndex } = await import("@/server/ai.server");
    const style = styleForIndex(data.index);
    const result = data.provider === "meta" ? await renderMetaOnce(data.photo, style) : await renderFallbackOnce(data.photo, style);
    return result.ok ? { ...result, image: `data:image/png;base64,${result.image}` } : result;
  });
