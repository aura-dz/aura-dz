import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-session";
import { prisma } from "@/lib/db";

export async function GET() {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });

  try {
    const records = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        number: true,
        status: true,
        fullName: true,
        phone: true,
        address: true,
        customerNote: true,
        deliveryType: true,
        subtotal: true,
        shippingFee: true,
        paymentMethod: true,
        paymentStatus: true,
        createdAt: true,
        wilaya: { select: { nameAr: true } },
        commune: { select: { nameAr: true } },
        customer: { select: { email: true } },
        items: { select: { productName: true, size: true, colorName: true, quantity: true } },
        shipment: { select: { trackingId: true, status: true } },
      },
    });

    return NextResponse.json({ orders: records.map((order) => ({
      number: order.number,
      status: order.status,
      fullName: order.fullName,
      phone: order.phone,
      email: order.customer.email || "",
      wilaya: order.wilaya.nameAr,
      commune: order.commune?.nameAr || "غير محددة",
      address: order.address || "",
      note: order.customerNote || "",
      product: order.items.map((item) => `${item.productName} × ${item.quantity}`).join("، "),
      size: order.items.map((item) => item.size).join("، "),
      color: order.items.map((item) => item.colorName).join("، "),
      quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      delivery: order.deliveryType === "HOME" ? "للمنزل" : "لمكتب التوصيل",
      payment: order.paymentStatus === "PAID" ? "مدفوع" : "الدفع عند الاستلام",
      createdAt: order.createdAt.toISOString(),
      trackingId: order.shipment?.trackingId || "",
    })) });
  } catch (error) {
    console.error("Admin order lookup failed", error);
    return NextResponse.json({ error: "Unable to load orders" }, { status: 500 });
  }
}