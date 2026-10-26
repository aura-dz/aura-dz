import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { DeliveryType, PaymentMethod, Prisma, StockMovementType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizeAlgerianPhone } from "@/lib/phone";
import { wilayas } from "@/lib/wilayas";

const orderSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().min(9).max(18),
  wilayaId: z.number().int().positive(),
  communeName: z.string().trim().min(2).max(120).optional(),
  address: z.string().trim().max(500).optional(),
  customerNote: z.string().trim().max(1000).optional(),
  deliveryType: z.nativeEnum(DeliveryType),
  items: z.array(z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(20) })).min(1).max(30),
});

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Order service is not configured" }, { status: 503 });
  }

  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid order details" }, { status: 422 });

  let phone: string;
  try {
    phone = normalizeAlgerianPhone(parsed.data.phone);
  } catch {
    return NextResponse.json({ error: "Invalid Algerian phone number" }, { status: 422 });
  }

  const requestedItems = new Map<string, number>();
  for (const item of parsed.data.items) {
    const quantity = (requestedItems.get(item.variantId) ?? 0) + item.quantity;
    if (quantity > 20) return NextResponse.json({ error: "الحد الأقصى 20 قطعة من المتغير الواحد." }, { status: 422 });
    requestedItems.set(item.variantId, quantity);
  }

  const selectedWilaya = wilayas.find(([id]) => id === parsed.data.wilayaId);
  if (!selectedWilaya) return NextResponse.json({ error: "الولاية المختارة غير صالحة." }, { status: 422 });

  try {
    const order = await prisma.$transaction(async (tx) => {
      const [customer, rate, variants] = await Promise.all([
        tx.customer.findUnique({ where: { phone } }),
        tx.deliveryRate.findFirst({ where: { wilayaId: parsed.data.wilayaId, type: parsed.data.deliveryType, isActive: true }, orderBy: { estimatedDays: "asc" } }),
        tx.variant.findMany({ where: { id: { in: [...requestedItems.keys()] }, isActive: true }, include: { product: true } }),
      ]);

      if (customer?.isBlacklisted) throw new OrderError("Unable to place this order", 403);
      if (variants.length !== requestedItems.size) throw new OrderError("One or more products are unavailable", 422);

      const wilaya = await tx.wilaya.upsert({
        where: { id: selectedWilaya[0] },
        create: { id: selectedWilaya[0], nameAr: selectedWilaya[1], nameFr: selectedWilaya[2] },
        update: {},
      });
      const commune = parsed.data.communeName
        ? await tx.commune.findFirst({
          where: { wilayaId: wilaya.id, nameAr: { equals: parsed.data.communeName, mode: "insensitive" } },
        }) ?? await tx.commune.create({
          data: { wilayaId: wilaya.id, nameAr: parsed.data.communeName, nameFr: parsed.data.communeName },
        })
        : null;

      const items = variants.map((variant) => {
        const quantity = requestedItems.get(variant.id)!;
        if (!variant.product.isActive) throw new OrderError("One or more products are unavailable", 422);
        return { variant, quantity, unitPrice: variant.priceOverride ?? variant.product.basePrice };
      });

      const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const defaultShippingFee = parsed.data.deliveryType === DeliveryType.DESK
        ? Number(process.env.DEFAULT_DESK_DELIVERY_FEE || 450)
        : Number(process.env.DEFAULT_HOME_DELIVERY_FEE || 700);
      const shippingFee = rate?.price ?? defaultShippingFee;
      const savedCustomer = customer
        ? await tx.customer.update({ where: { id: customer.id }, data: { fullName: parsed.data.fullName, totalOrders: { increment: 1 } } })
        : await tx.customer.create({ data: { fullName: parsed.data.fullName, phone, totalOrders: 1 } });

      const createdOrder = await tx.order.create({
        data: {
          number: `RB-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`,
          customerId: savedCustomer.id,
          fullName: parsed.data.fullName,
          phone,
          wilayaId: parsed.data.wilayaId,
          communeId: commune?.id ?? null,
          address: parsed.data.address,
          customerNote: parsed.data.customerNote,
          deliveryType: parsed.data.deliveryType,
          subtotal,
          shippingFee,
          total: subtotal + shippingFee,
          paymentMethod: PaymentMethod.COD,
          items: {
            create: items.map(({ variant, quantity, unitPrice }) => ({
              variantId: variant.id,
              productName: variant.product.nameAr,
              size: variant.size,
              colorName: variant.colorName,
              unitPrice,
              unitCost: variant.product.costPrice,
              quantity,
            })),
          },
        },
        select: { id: true, number: true, confirmToken: true, total: true },
      });

      await Promise.all(items.map(({ variant, quantity }) => Promise.all([
        tx.variant.update({ where: { id: variant.id }, data: { reserved: { increment: quantity } } }),
        tx.stockMovement.create({ data: { variantId: variant.id, type: StockMovementType.RESERVE, quantity, orderId: createdOrder.id } }),
      ])));
      await tx.orderStatusHistory.create({ data: { orderId: createdOrder.id, fromStatus: null, toStatus: "PENDING", actor: "customer", note: "Created from storefront" } });

      return createdOrder;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ error: "Please retry your order" }, { status: 409 });
    }
    console.error("Order creation failed", error);
    return NextResponse.json({ error: "Unable to create order" }, { status: 500 });
  }
}

class OrderError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}