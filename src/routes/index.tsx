import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { HomePhotoDemo } from "@/components/home-photo-demo";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/pasko-layout";
import { howItWorks, packages, photoStyles } from "@/lib/pasko-content";
import ChristmasStudio from "@/assets/christmas-studio.jpg.asset.json";
import FiveScenes from "@/assets/pasko-five-scenes.webp.asset.json";
import HowItWorksImage from "@/assets/pasko-how-it-works.jpg.asset.json";
import StudioArtwork from "@/assets/pasko-christmas-studio.jpg.asset.json";
import PackageChoices from "@/assets/pasko-package-choices.jpeg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Pasko Photo Magic | Christmas Portraits from Your Photo" },
    { name: "description", content: "Turn one favorite photo into five joyful Christmas portraits for the whole family." },
    { property: "og:title", content: "Pasko Photo Magic | Christmas Portraits from Your Photo" },
    { property: "og:description", content: "One photo becomes five festive portraits made for sharing." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: HomePage,
});

function HomePage() {
  return <div className="backdrop-page"><SiteHeader /><main className="home-content">
    <section className="hero-poster" aria-label="Pasko Photo Magic Christmas portraits"><img className="hero-backdrop" src={ChristmasStudio.url} alt="" /><img className="hero-artwork" src={StudioArtwork.url} alt="Pasko Photo Magic: turn your old photo into 5 amazing Christmas photos. Original portrait beside five illustrative Christmas transformations." /></section>
    <HomePhotoDemo />
    <section className="content-section" id="pricing" aria-labelledby="pricing-heading">
      <p className="page-eyebrow">Make this Christmas one to remember</p><h1 className="section-heading" id="pricing-heading">Five joyful portraits from one favorite photo</h1>
      <p className="section-lede">Made for sharing with the people you love.</p><img className="package-art" src={PackageChoices.url} alt="Basic Magic and Magic with Music package choices" />
      <div className="package-grid">{(Object.keys(packages) as (keyof typeof packages)[]).map((id) => <article className={`package-card${id === "premium" ? " package-card-premium" : ""}`} key={id}>
        <h2>{packages[id].name}</h2><p className="package-price">₱{packages[id].price}</p><p>{packages[id].details}</p><Button asChild><Link to="/create" search={{ pkg: id }}>Choose {id === "premium" ? "with Music" : "Basic"} <ArrowRight /></Link></Button>
      </article>)}</div>
      <div className="feature-strip"><div><strong>5 portraits</strong><span>Festive looks for your family</span></div><div><strong>One upload</strong><span>Start with a favorite photo</span></div><div><strong>Filipino spirit</strong><span>Inspired by Paskong Pinoy</span></div><div><strong>From ₱99</strong><span>Two packages to choose from</span></div></div>
    </section>
    <section className="content-section" id="how-it-works"><p className="page-eyebrow">Simple from start to finish</p><h2 className="section-heading">Your Christmas magic, in four steps</h2><p className="section-lede">From your camera roll to a collection of Christmas memories.</p><img className="steps-art" src={HowItWorksImage.url} alt="How to create your Pasko Photo Magic portraits" />
      <ol className="process-list">{howItWorks.map((item, index) => <li key={item.title}><span className="process-number">{index + 1}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div></li>)}</ol><div className="page-action"><Button asChild variant="outline"><Link to="/how-it-works">See how it works <ArrowRight /></Link></Button></div>
    </section>
    <section className="content-section" id="sample-photos"><p className="page-eyebrow">A little Pasko magic for everyone</p><h2 className="section-heading">Five festive styles with Filipino warmth</h2><p className="section-lede">Explore the looks included in every package.</p><img className="styles-art" src={FiveScenes.url} alt="Five Christmas portrait styles" />
      <div className="style-list">{photoStyles.map((style) => <div className="style-item" key={style.key}><Sparkles aria-hidden="true" size={17} /><div><strong>{style.name}</strong><span>{style.detail}</span></div><Check aria-hidden="true" size={16} /></div>)}</div><div className="page-action"><Button asChild variant="outline"><Link to="/samples">Explore all styles <ArrowRight /></Link></Button></div>
    </section>
    <section className="content-section" id="faq"><p className="page-eyebrow">Helpful answers</p><h2 className="section-heading">A few things to know</h2><div className="faq-list"><details><summary>What kind of photo should I upload?</summary><p>Choose one clear photo where the face is easy to see. JPG, PNG, and WEBP images up to 10 MB are accepted.</p></details><details><summary>How many Christmas photos are included?</summary><p>Both packages include five Christmas portraits in the styles shown above.</p></details><details><summary>Which package includes music?</summary><p>Magic with Music includes a slideshow with music. Basic Magic includes five photos without background music.</p></details><details><summary>How do I pay?</summary><p>Choose GCash, Maya, or bank transfer when you place your order. The studio reviews payment before creating your photos.</p></details></div><div className="page-action"><Button asChild variant="outline"><Link to="/faq">More answers <ArrowRight /></Link></Button></div></section>
  </main><SiteFooter /></div>;
}