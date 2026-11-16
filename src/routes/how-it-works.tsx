import { createFileRoute } from "@tanstack/react-router";
import { HowItWorksPage } from "@/components/pasko-pages";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({ meta: [
    { title: "How It Works | Pasko Photo Magic" },
    { name: "description", content: "See how one photo becomes five Christmas portraits." },
    { property: "og:title", content: "How It Works | Pasko Photo Magic" },
    { property: "og:description", content: "Four simple steps to festive family portraits." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: HowItWorksPage,
});