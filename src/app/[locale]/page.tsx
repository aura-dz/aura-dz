import Storefront from "@/components/storefront";
import { prisma } from "@/lib/db";
import { connection } from "next/server";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await connection();
  const records = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    include: {
      category: { select: { slug: true, nameAr: true, nameFr: true } },
      images: { orderBy: { sortOrder: "asc" }, select: { url: true, alt: true } },
      variants: { where: { isActive: true }, select: { id: true, size: true, colorName: true, colorHex: true, priceOverride: true, stock: true, reserved: true } },
    },
  });

  const products = records.map((product) => ({
    id: product.id,
    nameAr: product.nameAr,
    nameFr: product.nameFr,
    group: product.category.slug === "caftans" ? "caftans" as const : product.category.slug === "day-dresses" ? "daily" as const : "evening" as const,
    categoryAr: product.category.nameAr,
    categoryFr: product.category.nameFr,
    price: product.basePrice,
    comparePrice: product.comparePrice,
    best: product.isFeatured,
    images: product.images.map((image) => ({ url: image.url, alt: image.alt })),
    stock: product.variants.reduce((sum, variant) => sum + Math.max(0, variant.stock - variant.reserved), 0),
    variants: product.variants,
  }));

  return <Storefront locale={locale} products={products} />;
}