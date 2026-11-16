import { createFileRoute } from "@tanstack/react-router";
import { FaqPage } from "@/components/pasko-pages";

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: [
    { title: "Frequently Asked Questions | Pasko Photo Magic" },
    { name: "description", content: "Answers about packages, photo uploads, payment, and Christmas portrait delivery." },
    { property: "og:title", content: "Frequently Asked Questions | Pasko Photo Magic" },
    { property: "og:description", content: "Helpful answers about your photo order." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: FaqPage,
});