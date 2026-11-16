import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/components/pasko-pages";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [
    { title: "Contact the Studio | Pasko Photo Magic" },
    { name: "description", content: "Get help with your Pasko Photo Magic order." },
    { property: "og:title", content: "Contact the Studio | Pasko Photo Magic" },
    { property: "og:description", content: "Contact the Pasko Photo Magic team." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: ContactPage,
});