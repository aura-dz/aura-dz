"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { wilayas } from "@/lib/wilayas";

type PurchaseVariant = { id: string; size: string; colorName: string; colorHex: string | null; priceOverride: number | null; stock: number; reserved: number };
type DirectPurchase = { id: string; variantId: string; name: string; price: number; basePrice: number; image: string; size: string; colorName: string; variants: PurchaseVariant[]; quantity: number };

export default function CheckoutForm({ locale }: { locale: string }) {
  const [purchase, setPurchase] = useState<DirectPurchase | null>(null);
  const [delivery, setDelivery] = useState("home");
  const [order, setOrder] = useState<{ number: string; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const rtl = locale === "ar";
  const money = (amount: number) => `${new Intl.NumberFormat(rtl ? "ar-DZ" : "fr-DZ").format(amount)} ${rtl ? "د.ج" : "DA"}`;
  const subtotal = (purchase?.price ?? 0) * (purchase?.quantity ?? 0);
  const shipping = delivery === "desk" ? 450 : 700;

  function updateVariant(field: "size" | "colorName", value: string) {
    if (!purchase) return;
    const matching = purchase.variants.find((variant) => variant[field] === value && variant.size === (field === "size" ? value : purchase.size) && variant.colorName === (field === "colorName" ? value : purchase.colorName));
    const fallback = matching ?? purchase.variants.find((variant) => variant[field] === value);
    if (!fallback) return;
    setPurchase({
      ...purchase,
      variantId: fallback.id,
      size: fallback.size,
      colorName: fallback.colorName,
      price: fallback.priceOverride ?? purchase.basePrice,
    });
  }

  function updateQuantity(amount: number) {
    setPurchase((current) => current ? { ...current, quantity: Math.max(1, Math.min(20, current.quantity + amount)) } : null);
  }

  useEffect(() => {
    try {
      const savedPurchase = JSON.parse(localStorage.getItem("aurabelle-direct-purchase") || "null");
      const isValidPurchase = savedPurchase && typeof savedPurchase.id === "string" && typeof savedPurchase.variantId === "string" && typeof savedPurchase.name === "string" && Number.isInteger(savedPurchase.price) && Number.isInteger(savedPurchase.basePrice) && typeof savedPurchase.image === "string" && typeof savedPurchase.size === "string" && typeof savedPurchase.colorName === "string" && Array.isArray(savedPurchase.variants) && Number.isInteger(savedPurchase.quantity);
      startTransition(() => {
        setPurchase(isValidPurchase ? savedPurchase as DirectPurchase : null);
      });
    } catch {
      startTransition(() => setPurchase(null));
    }
  }, []);

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const addressLines = String(formData.get("communeAddress") ?? "").split(/\r?\n/);
    const hasCommune = addressLines.length > 1;
    const communeName = hasCommune ? addressLines.shift()?.trim() : "";
    const address = addressLines.join(" ").trim();
    if ((communeName && communeName.length < 2) || !address || address.length > 500) {
      setError(rtl
        ? "أدخلي العنوان بالتفصيل. إذا أضفتِ البلدية، اكتبيها في السطر الأول والعنوان في السطر الثاني."
        : "Indiquez l’adresse détaillée. Si vous ajoutez la commune, saisissez-la sur la première ligne et l’adresse sur la deuxième.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: formData.get("name"),
          phone: formData.get("phone"),
          wilayaId: Number(formData.get("wilaya")),
          communeName: communeName || undefined,
          address,
          customerNote: formData.get("note"),
          deliveryType: delivery === "desk" ? "DESK" : "HOME",
          items: purchase ? [{ variantId: purchase.variantId, quantity: purchase.quantity }] : [],
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || (rtl ? "تعذر تسجيل الطلب." : "Impossible d’enregistrer la commande."));
      setOrder({ number: result.order.number, total: result.order.total });
      localStorage.removeItem("aurabelle-direct-purchase");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : (rtl ? "تعذر الاتصال بالخادم." : "Erreur de connexion au serveur."));
    } finally {
      setSubmitting(false);
    }
  }

  if (order) {
    return <main className="order-success"><p className="eyebrow">{rtl ? "شكرًا لاختياركِ Aurabelle" : "Merci d’avoir choisi Aurabelle"}</p><h1>{rtl ? "تم تسجيل طلبكِ" : "Votre commande est enregistrée"}</h1><p>{rtl ? `رقم طلبكِ ${order.number} · الإجمالي ${money(order.total)}. سيتواصل معكِ فريقنا لتأكيد تفاصيل التوصيل.` : `Commande ${order.number} · Total ${money(order.total)}. Notre équipe vous contactera pour confirmer la livraison.`}</p><Link href={`/${locale}`}>{rtl ? "العودة إلى المتجر" : "Retour à la boutique"}</Link></main>;
  }

  return <main className="checkout-shell"><h1 className="checkout-title">{rtl ? "تفاصيل التوصيل" : "Détails de livraison"}</h1><div className="checkout-layout">
    <form className="checkout-form" onSubmit={submitOrder}>
      <label>{rtl ? "الاسم الكامل" : "Nom complet"}<input name="name" autoComplete="name" required /></label>
      <label>{rtl ? "رقم الهاتف" : "Téléphone"}<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="05 / 06 / 07" pattern="(\+213|0)[0-9]{9}" required /></label>
      <label>{rtl ? "الولاية" : "Wilaya"}<select name="wilaya" required defaultValue=""><option value="" disabled>{rtl ? "اختاري ولايتكِ" : "Choisir une wilaya"}</option>{wilayas.map(([id, nameAr, nameFr]) => <option key={id} value={id}>{rtl ? nameAr : nameFr}</option>)}</select></label>
      <label>{rtl ? "العنوان بالتفصيل (مطلوب) والبلدية (اختياري)" : "Adresse détaillée (obligatoire) et commune (facultative)"}<textarea name="communeAddress" autoComplete="street-address" placeholder={rtl ? "اكتبي العنوان بالتفصيل. لإضافة البلدية، اكتبيها في السطر الأول والعنوان في السطر الثاني." : "Saisissez l’adresse détaillée. Pour ajouter la commune, mettez-la en première ligne et l’adresse en deuxième."} required minLength={3} maxLength={621} rows={3} /></label>
      <label>{rtl ? "ملاحظة للطلب" : "Note pour la commande"}<input name="note" maxLength={1000} /></label>
      <div className="delivery-options"><label className="delivery-option"><input type="radio" name="delivery" checked={delivery === "home"} onChange={() => setDelivery("home")} /><span>{rtl ? "للمنزل" : "À domicile"}<small>{money(700)}</small></span></label><label className="delivery-option"><input type="radio" name="delivery" checked={delivery === "desk"} onChange={() => setDelivery("desk")} /><span>{rtl ? "لمكتب التوصيل" : "Au bureau"}<small>{money(450)}</small></span></label></div>
      {error && <p className="checkout-error" role="alert">{error}</p>}
      <button className="checkout-submit" type="submit" disabled={!purchase || submitting}>{submitting ? (rtl ? "جارٍ تسجيل الطلب..." : "Enregistrement...") : rtl ? "تأكيد الطلب · الدفع عند الاستلام" : "Confirmer · paiement à la livraison"}</button>
    </form>
    <aside className="checkout-summary"><h2>{rtl ? "ملخص الشراء" : "Résumé d’achat"}</h2>{purchase && <div className="purchase-summary-item"><strong>{purchase.name}</strong><div className="purchase-variant-controls"><label>{rtl ? "المقاس" : "Taille"}<select value={purchase.size} onChange={(event) => updateVariant("size", event.target.value)}>{[...new Set(purchase.variants.map((variant) => variant.size))].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><label>{rtl ? "اللون" : "Couleur"}<select value={purchase.colorName} onChange={(event) => updateVariant("colorName", event.target.value)}>{[...new Set(purchase.variants.map((variant) => variant.colorName))].map((color) => <option key={color} value={color}>{color}</option>)}</select></label></div><div className="purchase-quantity"><span>{rtl ? "الكمية" : "Quantité"}</span><div><button type="button" aria-label={rtl ? "إنقاص الكمية" : "Diminuer"} disabled={purchase.quantity <= 1} onClick={() => updateQuantity(-1)}><Minus /></button><strong>{purchase.quantity}</strong><button type="button" aria-label={rtl ? "زيادة الكمية" : "Augmenter"} disabled={purchase.quantity >= 20} onClick={() => updateQuantity(1)}><Plus /></button></div></div><p className="purchase-line-total"><span>{rtl ? "سعر القطعة" : "Prix unitaire"}</span><strong>{money(purchase.price)}</strong></p></div>}<p><span>{rtl ? "التوصيل" : "Livraison"}</span><strong>{money(shipping)}</strong></p><p className="total"><span>{rtl ? "الإجمالي التقديري" : "Total estimé"}</span><strong>{money(subtotal + shipping)}</strong></p></aside>
  </div></main>;
}