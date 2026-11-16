import SantaStyle from "@/assets/template-simbang-casual.jpg.asset.json";
import WinterStyle from "@/assets/style-winter.jpg.asset.json";
import PajamaStyle from "@/assets/template-pajama-santa-cap-45.jpg.asset.json";
import StreetStyle from "@/assets/style-lights.jpg.asset.json";
import BarongStyle from "@/assets/style-fashion.jpg.asset.json";

export const packages = {
  basic: {
    name: "Basic Magic",
    price: 99,
    details: "5 Christmas photos · No background music",
    summary: "5 Christmas photos",
  },
  premium: {
    name: "Magic with Music",
    price: 149,
    details: "5 Christmas photos · Slideshow + music",
    summary: "5 photos · Slideshow + music",
  },
} as const;

export type PackageId = keyof typeof packages;

export const DEFAULT_PRICES = { basic: 99, premium: 149 } as const;

export const photoStyles = [
  { key: "santa", name: "Simbang Gabi", detail: "A warm Filipino Christmas tradition", image: SantaStyle.url },
  { key: "winter", name: "Snow", detail: "A cozy winter wonderland", image: WinterStyle.url },
  { key: "family", name: "Pajama", detail: "A relaxed family Christmas at home", image: PajamaStyle.url },
  { key: "lights", name: "Street Celebration", detail: "Bright lights and festive nights", image: StreetStyle.url },
  { key: "fashion", name: "Traditional / Barong", detail: "An elegant holiday portrait", image: BarongStyle.url },
] as const;

export const STYLES = [
  { key: "santa", name: "Simbang Gabi", prompt: "Create a photorealistic Filipino Simbang Gabi family portrait at a historic stone church at dusk, with glowing parol lanterns, warm lights, and modest casual festive clothes. No snow, text, or watermarks." },
  { key: "family", name: "Pajama", prompt: "Create a cozy Christmas family portrait in matching red-and-green pajamas and Santa hats in a warm living room with a decorated tree, wrapped gifts, and golden lights. No text or watermarks." },
  { key: "winter", name: "Snow", prompt: "Create a bright photorealistic snowy pine forest Christmas portrait with cozy winter coats, knitted scarves, and soft falling snow. Keep faces clear and natural. No text or watermarks." },
  { key: "lights", name: "Street Celebration", prompt: "Create a festive Filipino Christmas street portrait at night beneath glowing colorful parol lanterns and string lights, with joyful celebration in the background and coordinated red holiday outfits. No text or watermarks." },
  { key: "fashion", name: "Traditional / Barong", prompt: "Create an elegant Filipino Christmas portrait in a Spanish-colonial home with capiz windows, carved wood, a chandelier, a Christmas tree, and glowing parols. Dress men in cream embroidered barong and women in burgundy Filipiniana gowns. No text or watermarks." },
] as const;

export type TemplateId = (typeof STYLES)[number]["key"];

export const PAYMENT_METHODS = { gcash: "GCash", maya: "Maya", bank: "Bank transfer" } as const;
export const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Pending payment",
  pending_verification: "Waiting for verification",
  payment_verified: "Payment verified",
  processing: "Creating your photos",
  completed: "Photos ready",
  rejected: "Payment rejected",
  failed: "Needs attention",
};

export function normalizePhMobile(input: string): string | null {
  const value = input.replace(/[\s-]/g, "");
  if (/^09\d{9}$/.test(value)) return `+63${value.slice(1)}`;
  if (/^\+639\d{9}$/.test(value)) return value;
  if (/^639\d{9}$/.test(value)) return `+${value}`;
  return null;
}

export function peso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}

export function validatePhoto(file: { type: string; size: number }): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Choose a JPG, PNG, or WEBP photo.";
  if (file.size > 10 * 1024 * 1024) return "Your photo must be 10 MB or smaller.";
  if (file.size < 10 * 1024) return "This photo is too small. Please choose a clearer image.";
  return null;
}

export const howItWorks = [
  { title: "Upload your old photo", detail: "Any clear photo of a face — old, faded or new." },
  { title: "Choose your template", detail: "Pick your first Christmas look. All five styles are included." },
  { title: "Payment", detail: "Choose ₱99 Basic or ₱149 with music. Pay with GCash, Maya or bank transfer." },
  { title: "Generate 5 photos", detail: "After payment verification, five Christmas photos are ready to download and share." },
] as const;