import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/pasko-pages";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [
    { title: "Privacy Policy | Pasko Photo Magic" }, { name: "description", content: "Learn how Pasko Photo Magic handles your personal information and photos." },
    { property: "og:title", content: "Privacy Policy | Pasko Photo Magic" }, { property: "og:description", content: "How your order details and uploaded photos are protected." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: () => <LegalPage title="Privacy Policy" sections={[
    { title: "What we collect", text: "Your name, mobile number, optional email, payment reference and one uploaded photo to process your order." },
    { title: "Private photo storage", text: "Uploaded and finished photos are stored privately and can be viewed only through your private order link or by authorized studio staff." },
    { title: "AI processing", text: "Your photo is sent securely from the studio server to its image-generation provider only to create your Christmas portraits." },
    { title: "Retention", text: "Order information and photos are scheduled for automatic deletion after 30 days. You may request earlier deletion." },
    { title: "Your rights", text: "You may request access, correction, or deletion of your information in line with the Philippine Data Privacy Act of 2012 (RA 10173)." },
  ]} />,
});