"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import logo from "../../logo.jpg";
import addToCartIcon from "../../images.png";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Heart, Menu, Search, Truck, X } from "lucide-react";

export type StorefrontProduct = {
  id: string;
  nameAr: string;
  nameFr: string;
  group: "evening" | "caftans" | "daily";
  categoryAr: string;
  categoryFr: string;
  price: number;
  comparePrice: number | null;
  images: { url: string; alt: string | null }[];
  stock: number;
  variants: { id: string; size: string; colorName: string; colorHex: string | null; priceOverride: number | null; stock: number; reserved: number }[];
  best?: boolean;
};

type DirectPurchase = { id: string; variantId: string; name: string; price: number; basePrice: number; image: string; size: string; colorName: string; variants: StorefrontProduct["variants"]; quantity: number };

const categories = ["all", "evening", "caftans", "daily", "best"] as const;

export default function Storefront({ locale, products }: { locale: string; products: StorefrontProduct[] }) {
  const router = useRouter();
  const t = useTranslations("home");
  const rtl = locale === "ar";
  const Arrow = rtl ? ArrowLeft : ArrowRight;
  const [category, setCategory] = useState<(typeof categories)[number]>("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");

  const visibleProducts = useMemo(() => products.filter((product) => {
    const categoryMatch = category === "all" || (category === "best" ? product.best : product.group === category);
    return categoryMatch && `${product.nameAr} ${product.nameFr}`.toLowerCase().includes(query.toLowerCase());
  }), [category, products, query]);

  const money = (value: number) => `${new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-DZ").format(value)} ${locale === "ar" ? "د.ج" : "DA"}`;

  function buyNow(product: StorefrontProduct, variant: StorefrontProduct["variants"][number]) {
    const purchase: DirectPurchase = {
      id: product.id,
      variantId: variant.id,
      name: rtl ? product.nameAr : product.nameFr,
      price: variant.priceOverride ?? product.price,
      basePrice: product.price,
      image: product.images[0]?.url || "/placeholder-product.svg",
      size: variant.size,
      colorName: variant.colorName,
      variants: product.variants,
      quantity: 1,
    };
    localStorage.removeItem("aurabelle-cart");
    localStorage.setItem("aurabelle-direct-purchase", JSON.stringify(purchase));
    router.push(`/${locale}/checkout`);
  }

  function subscribe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.currentTarget.reset();
    setToast(t("joined"));
    window.setTimeout(() => setToast(""), 2600);
  }

  return (
    <>
      <div className="announcement">{t("announcement")}</div>
      <header className="site-header">
        <div className="header-inner">
          <button className="icon-button mobile-menu" aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}><Menu /></button>
          <nav className={`main-nav ${menuOpen ? "nav-open" : ""}`}>
            <a href="#collection" onClick={() => setMenuOpen(false)}>{t("navShop")}</a>
            <a href="#story" onClick={() => setMenuOpen(false)}>{t("navStory")}</a>
            <a href="#newsletter" onClick={() => setMenuOpen(false)}>{t("navContact")}</a>
          </nav>
          <a className="wordmark" href={`/${locale}`} aria-label="Aurabelle home"><span className="brand-seal"><Image src={logo} alt="" fill sizes="56px" /></span><span className="wordmark-copy"><strong>AURABELLE</strong><small>MADE FOR YOUR MOMENTS</small></span></a>
          <div className="header-actions">
            <button className="icon-button" aria-label={t("search")} onClick={() => setSearchOpen(!searchOpen)}><Search /><span>{locale === "ar" ? "بحث" : "Rechercher"}</span></button>
            <a className="locale-link" href={rtl ? "/fr" : "/ar"}>{rtl ? "FR" : "ع"}</a>
          </div>
        </div>
        {searchOpen && <div className="search-bar"><Search /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} aria-label={t("search")} /><button className="icon-button" aria-label="Close search" onClick={() => { setSearchOpen(false); setQuery(""); }}><X /></button></div>}
      </header>

      <main>
        <section className="hero">
          <div className="hero-image" />
          <div className="hero-inner">
            <div className="hero-copy"><p className="eyebrow">{t("heroEyebrow")}</p><h1>{t("heroTitle")}</h1><p className="hero-description">{t("heroBody")}</p><a className="light-button" href="#collection">{t("shopNow")} <Arrow size={16} /></a></div>
            <span className="hero-caption">A LITTLE MORE YOU · 2026</span>
          </div>
        </section>

        <section className="trust-strip">
          <span><Truck />{t("trustDelivery")}</span><span>◉ {t("trustPayment")}</span><span>↺ {t("trustReturns")}</span>
        </section>

        <section className="collection section-wrap" id="collection">
          <div className="section-heading"><div><p className="eyebrow">{t("collectionEyebrow")}</p><h2>{t("collectionTitle")}</h2></div><p>{t("collectionNote")}</p></div>
          <div className="filters" role="group" aria-label={t("collectionTitle")}>
            {categories.map((key) => <button key={key} className={category === key ? "filter active" : "filter"} onClick={() => setCategory(key)}>{t(key)}</button>)}
          </div>
          <div className="product-grid">
            {visibleProducts.map((product) => {
              return <ProductCard key={product.id} product={product} locale={locale} money={money} soldLabel={t("soldOut")} soldBadge={t("soldBadge")} buyLabel={t("buyNow")} onBuy={(variant) => buyNow(product, variant)} favorite={favorites.includes(product.id)} onFavorite={() => setFavorites((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} />;
            })}
          </div>
          {!visibleProducts.length && <p className="empty-results">{query ? (locale === "ar" ? "لا توجد نتائج مطابقة." : "Aucun résultat.") : (locale === "ar" ? "لا توجد منتجات منشورة بعد." : "Aucun produit publié pour le moment.")}</p>}
        </section>

        <section className="story-band" id="story"><div className="story-photo" /><div className="story-copy"><p className="eyebrow">{t("storyEyebrow")}</p><h2>{t("storyTitle")}</h2><p>{t("storyBody")}</p><a className="text-link" href="#collection">{t("shopNow")} <Arrow size={15} /></a></div></section>

        <section className="newsletter section-wrap" id="newsletter"><div><h2>{t("newsletterTitle")}</h2><p>{t("newsletterBody")}</p></div><form onSubmit={subscribe}><input type="email" placeholder={t("email")} aria-label={t("email")} required /><button type="submit">{t("subscribe")} <Arrow size={15} /></button></form></section>
      </main>

      <footer className="site-footer section-wrap"><a className="wordmark footer-mark" href={`/${locale}`}>AURABELLE</a><div><a href="#story">{t("navStory")}</a><a href="#newsletter">{t("navContact")}</a></div><small>{t("footer")}</small></footer>

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function ProductCard({ product, locale, money, soldLabel, soldBadge, buyLabel, onBuy, favorite, onFavorite }: {
  product: StorefrontProduct;
  locale: string;
  money: (value: number) => string;
  soldLabel: string;
  soldBadge: string;
  buyLabel: string;
  onBuy: (variant: StorefrontProduct["variants"][number]) => void;
  favorite: boolean;
  onFavorite: () => void;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const availableVariants = product.variants;
  const [selectedVariantId, setSelectedVariantId] = useState(availableVariants[0]?.id || "");
  const image = product.images[imageIndex];
  const selectedVariant = availableVariants.find((variant) => variant.id === selectedVariantId) ?? availableVariants[0];
  const availableSizes = [...new Set(availableVariants.map((variant) => variant.size))];
  const availableColors = [...new Map(availableVariants.map((variant) => [variant.colorName, variant.colorHex])).entries()];
  const sold = availableVariants.length === 0;
  const name = locale === "fr" ? product.nameFr : product.nameAr;

  return <article className="product-card">
    <div className="product-photo">
      {image && <Image src={image.url} alt={image.alt || name} fill sizes="(max-width: 600px) 46vw, (max-width: 900px) 40vw, 25vw" />}
      <span className="product-watermark" aria-hidden="true"><Image src={logo} alt="" fill sizes="80px" /></span>
      {sold ? <span className="product-badge sold-badge">{soldBadge}</span> : product.best ? <span className="product-badge">{locale === "ar" ? "الأكثر مبيعًا" : "Best-seller"}</span> : null}
      <button className={`favorite ${favorite ? "selected" : ""}`} aria-label={locale === "ar" ? "أضيفي للمفضلة" : "Add to favorites"} onClick={onFavorite}><Heart /></button>
      {product.images.length > 1 && <><button className="gallery-step gallery-previous" aria-label={locale === "ar" ? "الصورة السابقة" : "Previous image"} onClick={() => setImageIndex((index) => (index - 1 + product.images.length) % product.images.length)}>{locale === "ar" ? <ChevronRight /> : <ChevronLeft />}</button><button className="gallery-step gallery-next" aria-label={locale === "ar" ? "الصورة التالية" : "Next image"} onClick={() => setImageIndex((index) => (index + 1) % product.images.length)}>{locale === "ar" ? <ChevronLeft /> : <ChevronRight />}</button><span className="gallery-count">{imageIndex + 1} / {product.images.length}</span></>}
      {sold ? <span className="quick-add sold-label">{soldLabel}</span> : <button className="quick-add" aria-label={buyLabel} title={buyLabel} onClick={() => selectedVariant && onBuy(selectedVariant)}><Image src={addToCartIcon} alt="" width={40} height={40} /></button>}
    </div>
    {!sold && <button className="buy-product-button" onClick={() => selectedVariant && onBuy(selectedVariant)}>{buyLabel}</button>}
    <div className="product-details"><p>{locale === "ar" ? product.categoryAr : product.categoryFr}</p><h3>{name}</h3><div><strong>{money(selectedVariant?.priceOverride ?? product.price)}</strong>{product.comparePrice && <del>{money(product.comparePrice)}</del>}</div>{!sold && <div className="variant-pickers"><label><span>{locale === "ar" ? "المقاس" : "Taille"}</span><select value={selectedVariant?.size} onChange={(event) => { const next = availableVariants.find((variant) => variant.size === event.target.value && variant.colorName === selectedVariant?.colorName) ?? availableVariants.find((variant) => variant.size === event.target.value); if (next) setSelectedVariantId(next.id); }}>{availableSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></label><label><span>{locale === "ar" ? "اللون" : "Couleur"}</span><select value={selectedVariant?.colorName} onChange={(event) => { const next = availableVariants.find((variant) => variant.colorName === event.target.value && variant.size === selectedVariant?.size) ?? availableVariants.find((variant) => variant.colorName === event.target.value); if (next) setSelectedVariantId(next.id); }}>{availableColors.map(([color]) => <option key={color} value={color}>{color}</option>)}</select></label></div>}</div>
  </article>;
}