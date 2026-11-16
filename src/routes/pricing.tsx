import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "@/components/pasko-pages";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [
    { title: "Packages and Pricing | Pasko Photo Magic" },
    { name: "description", content: "Compare Basic Magic and Magic with Music Christmas photo packages." },
    { property: "og:title", content: "Packages and Pricing | Pasko Photo Magic" },
    { property: "og:description", content: "Five Christmas portraits from one favorite photo." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: PricingPage,
});