import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/pasko-pages";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [
    { title: "Terms and Conditions | Pasko Photo Magic" }, { name: "description", content: "Terms for ordering Christmas portraits from Pasko Photo Magic." },
    { property: "og:title", content: "Terms and Conditions | Pasko Photo Magic" }, { property: "og:description", content: "Review the terms for your Christmas photo order." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: () => <LegalPage title="Terms and Conditions" sections={[
    { title: "Orders", text: "Each order starts with one uploaded photo and includes five Christmas portraits in the displayed styles. You must own the photo or have permission from the people shown." },
    { title: "Payment", text: "Prices are in Philippine pesos. Photo creation begins after the studio verifies your payment." },
    { title: "AI results", text: "Portraits are created with AI. We aim to preserve likeness, but exact results cannot be guaranteed." },
    { title: "Appropriate uploads", text: "Do not submit images that are illegal, offensive, or depict people who have not consented. The studio may cancel inappropriate orders." },
    { title: "Downloads", text: "Please download finished portraits before the 30-day retention period ends. After that, order photos are scheduled for deletion." },
  ]} />,
});