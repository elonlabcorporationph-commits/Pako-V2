import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/jobs/cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"];
        const supplied = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        if (!secret) return new Response("Cleanup is not configured", { status: 503 });
        if (!supplied) return new Response("Unauthorized", { status: 401 });
        const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
        const [expected, actual] = await Promise.all([digest(secret), digest(supplied)]);
        let difference = 0;
        for (let index = 0; index < expected.length; index += 1) difference |= (expected[index] ?? 0) ^ (actual[index] ?? 0);
        const matches = difference === 0;
        if (!matches) return new Response("Unauthorized", { status: 401 });
        const { cleanupExpiredOrders } = await import("@/server/storage.server");
        const removed = await cleanupExpiredOrders();
        return Response.json({ success: true, removed });
      },
    },
  },
});