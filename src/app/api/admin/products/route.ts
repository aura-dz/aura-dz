import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-session";
import { prisma } from "@/lib/db";

const categories = {
  "فساتين سهرة": { slug: "evening-dresses", nameAr: "فساتين سهرة", nameFr: "Robes de soirée" },
  "قفاطين": { slug: "caftans", nameAr: "قفاطين", nameFr: "Caftans" },
  "فساتين يومية": { slug: "day-dresses", nameAr: "فساتين يومية", nameFr: "Robes de jour" },
} as const;

const variantSchema = z.array(z.object({
  size: z.string().trim().min(1).max(12),
  colorName: z.string().trim().min(1).max(40),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  stock: z.number().int().min(0).max(10000),
})).min(1).max(100);

const maxFileSize = 5 * 1024 * 1024;
const maxFiles = 8;
type EditableProduct = Prisma.ProductGetPayload<{ include: { images: true; variants: true } }>;
const allowedTypes = new Map([
  ["image/jpeg", { extension: "jpg", signature: (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ["image/png", { extension: "png", signature: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
  ["image/webp", { extension: "webp", signature: (bytes: Buffer) => bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" }],
  ["image/avif", { extension: "avif", signature: (bytes: Buffer) => bytes.toString("ascii", 4, 8) === "ftyp" && ["avif", "avis"].includes(bytes.toString("ascii", 8, 12)) }],
]);

export async function GET() {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });

  try {
    const products = await prisma.product.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        category: { select: { nameAr: true, nameFr: true } },
        images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, alt: true } },
        variants: { where: { isActive: true }, select: { size: true, colorName: true, colorHex: true, stock: true, reserved: true } },
      },
    });

    return NextResponse.json({ products: products.map((product) => ({
      id: product.id,
      nameAr: product.nameAr,
      nameFr: product.nameFr,
      descAr: product.descAr,
      descFr: product.descFr,
      category: product.category.nameAr,
      categoryFr: product.category.nameFr,
      price: product.basePrice,
      comparePrice: product.comparePrice,
      isActive: product.isActive,
      stock: product.variants.reduce((sum, variant) => sum + Math.max(0, variant.stock - variant.reserved), 0),
      images: product.images,
      variants: product.variants,
      createdAt: product.createdAt,
    })) });
  } catch (error) {
    console.error("Admin product lookup failed", error);
    return NextResponse.json({ error: "Unable to load products" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });

  if (request.headers.get("content-type")?.includes("application/json")) {
    const parsed = z.object({ duplicateProductId: z.string().min(1) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid product copy request" }, { status: 400 });

    try {
      const source = await prisma.product.findUnique({
        where: { id: parsed.data.duplicateProductId },
        include: { images: { orderBy: { sortOrder: "asc" } }, variants: { where: { isActive: true } } },
      });
      if (!source) return NextResponse.json({ error: "المنتج غير موجود." }, { status: 404 });

      const copySuffix = " (نسخة)";
      const product = await prisma.product.create({
        data: {
          slug: `${source.slug}-${randomUUID().slice(0, 8)}`,
          nameAr: `${source.nameAr.slice(0, 160 - copySuffix.length)}${copySuffix}`,
          nameFr: `${source.nameFr.slice(0, 152)} (copie)`,
          descAr: source.descAr,
          descFr: source.descFr,
          occasion: source.occasion,
          basePrice: source.basePrice,
          comparePrice: source.comparePrice,
          isActive: true,
          categoryId: source.categoryId,
          images: { create: source.images.map(({ url, alt }, index) => ({ url, alt, sortOrder: index })) },
          variants: { create: source.variants.map(({ size, colorName, colorHex }) => ({
            size, colorName, colorHex, stock: 0, reserved: 0, isActive: true,
          })) },
        },
        include: {
          category: { select: { nameAr: true, nameFr: true } },
          images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, alt: true } },
          variants: { where: { isActive: true }, select: { size: true, colorName: true, colorHex: true, stock: true, reserved: true } },
        },
      });
      return NextResponse.json({ product: serializeProduct(product) }, { status: 201 });
    } catch (error) {
      console.error("Product duplication failed", error);
      return NextResponse.json({ error: "تعذر نسخ المنتج." }, { status: 500 });
    }
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid product form" }, { status: 400 });

  const parsed = z.object({
    nameAr: z.string().trim().min(2).max(160),
    nameFr: z.string().trim().min(2).max(160),
    category: z.enum(["فساتين سهرة", "قفاطين", "فساتين يومية"]),
    basePrice: z.coerce.number().int().positive().max(100000000),
    comparePrice: z.union([z.literal(""), z.coerce.number().int().positive().max(100000000)]).optional(),
    descAr: z.string().trim().max(5000).optional(),
    descFr: z.string().trim().max(5000).optional(),
    variants: z.string().min(2).max(20000),
  }).safeParse({
    nameAr: form.get("nameAr"),
    nameFr: form.get("nameFr"),
    category: form.get("category"),
    basePrice: form.get("basePrice"),
    comparePrice: form.get("comparePrice") ?? "",
    descAr: form.get("descAr") ?? "",
    descFr: form.get("descFr") ?? "",
    variants: form.get("variants"),
  });
  if (!parsed.success) return NextResponse.json({ error: "تحققي من بيانات المنتج والسعر." }, { status: 422 });

  const variantInput = z.string().transform((value, context) => {
    try { return JSON.parse(value) as unknown; }
    catch { context.addIssue({ code: "custom", message: "Invalid variants" }); return z.NEVER; }
  }).pipe(variantSchema).safeParse(parsed.data.variants);
  if (!variantInput.success) return NextResponse.json({ error: "تحققي من الألوان والمقاسات والمخزون." }, { status: 422 });

  const comparePrice = parsed.data.comparePrice === "" ? null : parsed.data.comparePrice ?? null;
  if (comparePrice !== null && comparePrice <= parsed.data.basePrice) {
    return NextResponse.json({ error: "السعر السابق يجب أن يكون أعلى من السعر الحالي." }, { status: 422 });
  }

  const keepImageIds = z.string().transform((value, context) => {
    try { return JSON.parse(value) as unknown; }
    catch { context.addIssue({ code: "custom", message: "Invalid image list" }); return z.NEVER; }
  }).pipe(z.array(z.string().min(1))).safeParse(String(form.get("keepImageIds") || "[]"));
  if (!keepImageIds.success) return NextResponse.json({ error: "تحققي من صور المنتج." }, { status: 422 });
  if (new Set(keepImageIds.data).size !== keepImageIds.data.length) return NextResponse.json({ error: "تحققي من صور المنتج." }, { status: 422 });
  const files = form.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const productId = form.get("productId");
  const editingId = typeof productId === "string" && productId ? productId : null;
  let existingProduct: EditableProduct | null = null;
  try {
    existingProduct = editingId ? await prisma.product.findUnique({ where: { id: editingId }, include: { images: true, variants: true } }) : null;
  } catch (error) {
    console.error("Product lookup for update failed", error);
    return NextResponse.json({ error: "تعذر تحميل المنتج للتعديل." }, { status: 500 });
  }
  if (editingId && !existingProduct) return NextResponse.json({ error: "المنتج غير موجود." }, { status: 404 });
  if (existingProduct && keepImageIds.data.some((id) => !existingProduct.images.some((image) => image.id === id))) {
    return NextResponse.json({ error: "تحتوي صور المنتج على بيانات غير صالحة." }, { status: 422 });
  }
  if (keepImageIds.data.length + files.length < 1 || keepImageIds.data.length + files.length > maxFiles) {
    return NextResponse.json({ error: `يجب أن يحتوي المنتج على صورة واحدة إلى ${maxFiles} صور.` }, { status: 422 });
  }

  let totalSize = 0;
  const uploads: { filename: string; url: string; alt: string; bytes: Buffer; contentType: string }[] = [];
  for (const file of files) {
    totalSize += file.size;
    const imageType = allowedTypes.get(file.type);
    if (!imageType || file.size > maxFileSize) {
      return NextResponse.json({ error: "تُقبل صور JPEG أو PNG أو WebP أو AVIF حتى 5 ميغابايت للصورة." }, { status: 422 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!imageType.signature(bytes)) return NextResponse.json({ error: "محتوى أحد الملفات لا يطابق نوع الصورة." }, { status: 422 });
    const filename = `${randomUUID()}.${imageType.extension}`;
    uploads.push({ filename, url: `/uploads/products/${filename}`, alt: parsed.data.nameAr, bytes, contentType: file.type });
  }
  if (totalSize > 25 * 1024 * 1024) return NextResponse.json({ error: "الحجم الإجمالي للصور يتجاوز 25 ميغابايت." }, { status: 422 });

  const writtenFiles: string[] = [];
  const storedBlobUrls: string[] = [];
  const uploadDirectory = path.join(process.cwd(), "public", "uploads", "products");
  const category = categories[parsed.data.category];
  const slugBase = parsed.data.nameFr.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";
  const slug = editingId ? existingProduct!.slug : `${slugBase}-${randomUUID().slice(0, 8)}`;
  const combinations = new Set(variantInput.data.map((variant) => `${variant.size}\u0000${variant.colorName}`));
  if (combinations.size !== variantInput.data.length) return NextResponse.json({ error: "لا يمكن تكرار اللون والمقاس." }, { status: 422 });
  if (existingProduct && variantInput.data.some((variant) => {
    const current = existingProduct.variants.find((entry) => entry.size === variant.size && entry.colorName === variant.colorName);
    return current && variant.stock < current.reserved;
  })) {
    return NextResponse.json({ error: "لا يمكن أن يقل المخزون عن الكمية المحجوزة للطلبات." }, { status: 422 });
  }

  const useBlobStorage = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  if (files.length && process.env.VERCEL && !useBlobStorage) {
    return NextResponse.json({ error: "لم يتم إعداد تخزين صور المنتجات. اربطي Vercel Blob بالتطبيق ثم أعيدي المحاولة." }, { status: 503 });
  }

  let savingImages = false;
  try {
    if (uploads.length && !useBlobStorage) {
      savingImages = true;
      await mkdir(uploadDirectory, { recursive: true });
    }
    for (const upload of uploads) {
      if (useBlobStorage) {
        savingImages = true;
        const blob = await put(upload.filename, upload.bytes, {
          access: "public",
          contentType: upload.contentType,
        });
        upload.url = blob.url;
        storedBlobUrls.push(blob.url);
      } else {
        const filePath = path.join(uploadDirectory, upload.filename);
        await writeFile(filePath, upload.bytes, { flag: "wx" });
        writtenFiles.push(filePath);
      }
    }
    savingImages = false;

    const product = await prisma.$transaction(async (tx) => {
      const savedCategory = await tx.category.upsert({
        where: { slug: category.slug },
        create: { ...category },
        update: {},
      });

      if (!existingProduct) {
        return tx.product.create({
          data: {
            slug,
            nameAr: parsed.data.nameAr,
            nameFr: parsed.data.nameFr,
            descAr: parsed.data.descAr || null,
            descFr: parsed.data.descFr || null,
            occasion: [],
            basePrice: parsed.data.basePrice,
            comparePrice,
            isActive: true,
            categoryId: savedCategory.id,
            images: { create: uploads.map((upload, index) => ({ url: upload.url, alt: upload.alt, sortOrder: index })) },
            variants: { create: variantInput.data.map((variant) => ({ ...variant, isActive: true })) },
          },
          include: {
            category: { select: { nameAr: true, nameFr: true } },
            images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, alt: true } },
            variants: { where: { isActive: true }, select: { size: true, colorName: true, colorHex: true, stock: true, reserved: true } },
          },
        });
      }

      const keptImages = existingProduct.images.filter((image) => keepImageIds.data.includes(image.id));
      if (keepImageIds.data.length) {
        await tx.productImage.deleteMany({ where: { productId: existingProduct.id, id: { notIn: keepImageIds.data } } });
      } else {
        await tx.productImage.deleteMany({ where: { productId: existingProduct.id } });
      }
      if (uploads.length) {
        await tx.productImage.createMany({
          data: uploads.map((upload, index) => ({ productId: existingProduct.id, url: upload.url, alt: upload.alt, sortOrder: keptImages.length + index })),
        });
      }

      const requestedVariants = new Set(variantInput.data.map((variant) => `${variant.size}\u0000${variant.colorName}`));
      for (const currentVariant of existingProduct.variants) {
        if (!requestedVariants.has(`${currentVariant.size}\u0000${currentVariant.colorName}`) && currentVariant.isActive) {
          await tx.variant.update({ where: { id: currentVariant.id }, data: { isActive: false } });
        }
      }
      for (const variant of variantInput.data) {
        const current = existingProduct.variants.find((entry) => entry.size === variant.size && entry.colorName === variant.colorName);
        if (current) {
          await tx.variant.update({
            where: { id: current.id },
            data: { colorHex: variant.colorHex, stock: variant.stock, isActive: true },
          });
        } else {
          await tx.variant.create({ data: { productId: existingProduct.id, ...variant, isActive: true } });
        }
      }

      return tx.product.update({
        where: { id: existingProduct.id },
        data: {
          nameAr: parsed.data.nameAr,
          nameFr: parsed.data.nameFr,
          descAr: parsed.data.descAr || null,
          descFr: parsed.data.descFr || null,
          basePrice: parsed.data.basePrice,
          comparePrice,
          isActive: true,
          categoryId: savedCategory.id,
        },
        include: {
          category: { select: { nameAr: true, nameFr: true } },
          images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, alt: true } },
          variants: { where: { isActive: true }, select: { size: true, colorName: true, colorHex: true, stock: true, reserved: true } },
        },
      });
    });

    return NextResponse.json({ product: serializeProduct(product) }, { status: existingProduct ? 200 : 201 });
  } catch (error) {
    const cleanupResults = await Promise.allSettled([
      ...writtenFiles.map((filePath) => unlink(filePath)),
      ...(storedBlobUrls.length ? [del(storedBlobUrls)] : []),
    ]);
    cleanupResults.forEach((result) => {
      if (result.status === "rejected") console.error("Product image cleanup failed", result.reason);
    });
    console.error("Product save failed", error);
    if (savingImages) {
      return NextResponse.json({
        error: useBlobStorage
          ? "تعذر رفع صور المنتج إلى التخزين السحابي. تحققي من إعدادات Vercel Blob ثم أعيدي المحاولة."
          : "تعذر حفظ صورة المنتج على الخادم المحلي.",
      }, { status: useBlobStorage ? 502 : 500 });
    }
    return NextResponse.json({ error: "تعذر حفظ المنتج. تحققي من البيانات ثم أعيدي المحاولة." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Product id is required" }, { status: 400 });

  try {
    const result = await prisma.product.updateMany({ where: { id }, data: { isActive: false } });
    if (!result.count) return NextResponse.json({ error: "المنتج غير موجود." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Product deactivation failed", error);
    return NextResponse.json({ error: "تعذر حذف المنتج." }, { status: 500 });
  }
}

function serializeProduct(product: {
  id: string;
  nameAr: string;
  nameFr: string;
  descAr: string | null;
  descFr: string | null;
  category: { nameAr: string; nameFr: string };
  basePrice: number;
  comparePrice: number | null;
  isActive: boolean;
  images: { id: string; url: string; alt: string | null }[];
  variants: { size: string; colorName: string; colorHex: string | null; stock: number; reserved: number }[];
  createdAt: Date;
}) {
  return {
    id: product.id,
    nameAr: product.nameAr,
    nameFr: product.nameFr,
    descAr: product.descAr,
    descFr: product.descFr,
    category: product.category.nameAr,
    categoryFr: product.category.nameFr,
    price: product.basePrice,
    comparePrice: product.comparePrice,
    isActive: product.isActive,
    stock: product.variants.reduce((sum, variant) => sum + Math.max(0, variant.stock - variant.reserved), 0),
    images: product.images,
    variants: product.variants,
    createdAt: product.createdAt,
  };
}