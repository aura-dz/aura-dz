import CheckoutForm from "@/components/checkout-form";

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <CheckoutForm locale={locale} />;
}