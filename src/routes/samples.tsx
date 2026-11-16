import { createFileRoute } from "@tanstack/react-router";
import { SamplesPage } from "@/components/pasko-pages";

export const Route = createFileRoute("/samples")({
  head: () => ({ meta: [
    { title: "Christmas Photo Samples | Pasko Photo Magic" },
    { name: "description", content: "Explore five Christmas portrait styles with Filipino holiday warmth." },
    { property: "og:title", content: "Christmas Photo Samples | Pasko Photo Magic" },
    { property: "og:description", content: "See the festive portrait styles included in each package." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: SamplesPage,
});