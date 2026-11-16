import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowRight, Check, Clock3, Mail, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/pasko-layout";
import { howItWorks, packages, photoStyles, peso } from "@/lib/pasko-content";
import FiveScenes from "@/assets/pasko-five-scenes.webp.asset.json";
import HowItWorksArt from "@/assets/pasko-how-it-works.jpg.asset.json";

export function PageFrame({ children }: { children: ReactNode }) {
  return <div className="backdrop-page"><SiteHeader /><main className="content-page">{children}</main><SiteFooter /></div>;
}

export function HowItWorksPage() {
  return <PageFrame><section className="content-section">
    <p className="page-eyebrow">A simple way to make a memory</p><h1 className="section-heading">Your Christmas magic, in four steps</h1>
    <p className="section-lede">From one photo to five festive portraits for everyone you love.</p>
    <img className="steps-art" src={HowItWorksArt.url} alt="How to create Pasko Photo Magic portraits" />
    <ol className="process-list">{howItWorks.map((step, index) => <li key={step.title}><span className="process-number">{index + 1}</span><div><strong>{step.title}</strong><p>{step.detail}</p></div></li>)}</ol>
    <div className="page-action"><Button asChild><Link to="/create" search={{ pkg: "basic" }}>Create your photos <ArrowRight /></Link></Button></div>
  </section></PageFrame>;
}

export function PricingPage() {
  return <PageFrame><section className="content-section">
    <p className="page-eyebrow">Choose your Christmas package</p><h1 className="section-heading">Five festive portraits from one photo</h1>
    <p className="section-lede">Each package includes five Christmas styles. Premium adds a music slideshow.</p>
    <div className="package-grid page-package-grid">{(Object.keys(packages) as (keyof typeof packages)[]).map((id) => <article className={`package-card${id === "premium" ? " package-card-premium" : ""}`} key={id}>
      <h2>{packages[id].name}</h2><p className="package-price">{peso(packages[id].price)}</p><p>{packages[id].details}</p>
      <ul className="package-features">{(id === "basic" ? ["5 Christmas photos", "5 different styles", "High-quality downloads"] : ["5 Christmas photos", "5 different styles", "Music slideshow", "High-quality downloads"]).map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
      <Button asChild><Link to="/create" search={{ pkg: id }}>Choose {id === "premium" ? "with music" : "Basic"} <ArrowRight /></Link></Button>
    </article>)}</div>
    <div className="preview-note"><ShieldCheck size={16} /> We review payment before creating your photos. Uploaded images are kept private.</div>
  </section></PageFrame>;
}

export function SamplesPage() {
  return <PageFrame><section className="content-section">
    <p className="page-eyebrow">A little Pasko magic for everyone</p><h1 className="section-heading">Five Christmas looks, one family</h1>
    <p className="section-lede">Filipino Christmas warmth, from Simbang Gabi to a snowy portrait.</p>
    <img className="styles-art" src={FiveScenes.url} alt="Five examples of Christmas portrait transformations" />
    <div className="sample-style-grid">{photoStyles.map((style) => <article className="sample-style" key={style.key}><img src={style.image} alt={`${style.name} Christmas portrait sample`} loading="lazy" /><div><Sparkles size={17} /><h2>{style.name}</h2><p>{style.detail}</p></div></article>)}</div>
  </section></PageFrame>;
}

export function FaqPage() {
  const faqs = [
    ["What kind of photo should I upload?", "Choose one clear photo where each face is easy to see. JPG, PNG, and WEBP images up to 10 MB are accepted."],
    ["How many Christmas photos are included?", "Both packages include five Christmas portraits in the festive styles shown above."],
    ["Which package includes music?", "Magic with Music includes a slideshow with music. Basic Magic includes five photos without background music."],
    ["How do I pay?", "Choose GCash, Maya, or bank transfer when you create your order. Your payment reference can be submitted from your private order page."],
    ["When will my photos be ready?", "The studio verifies payment first, then prepares the five styles. Your order page shows the latest status."],
    ["How long are photos kept?", "Order photos are automatically deleted after 30 days."],
  ];
  return <PageFrame><section className="content-section faq-page"><p className="page-eyebrow">Helpful answers</p><h1 className="section-heading">Frequently asked questions</h1>
    <div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
    <div className="page-action"><Button asChild variant="outline"><Link to="/contact">Ask us a question <ArrowRight /></Link></Button></div>
  </section></PageFrame>;
}

export function ContactPage() {
  return <PageFrame><section className="content-section contact-page"><p className="page-eyebrow">We’re here to help</p><h1 className="section-heading">Contact the studio</h1>
    <p className="section-lede">For order help, please include your order number.</p>
    <div className="contact-options"><a href="mailto:hello@xmasmagic.ph"><Mail /><span><small>Email</small><strong>hello@xmasmagic.ph</strong></span></a><a href="https://m.me/xmasmagicph" target="_blank" rel="noreferrer"><MessageCircle /><span><small>Facebook Messenger</small><strong>m.me/xmasmagicph</strong></span></a><div><Clock3 /><span><small>Support hours</small><strong>Mon–Sun, 9 AM–9 PM (PH time)</strong></span></div></div>
    <div className="page-action"><Button asChild><Link to="/track">Track an order <ArrowRight /></Link></Button></div>
  </section></PageFrame>;
}

export function LegalPage({ title, sections }: { title: string; sections: Array<{ title: string; text: string }> }) {
  return <PageFrame><article className="content-section legal-page"><p className="page-eyebrow">Pasko Photo Magic</p><h1 className="section-heading">{title}</h1>{sections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.text}</p></section>)}</article></PageFrame>;
}