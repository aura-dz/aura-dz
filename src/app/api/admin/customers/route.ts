import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-session";
import { prisma } from "@/lib/db";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(100).default(""),
});

export async function GET(request: Request) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    page: url.searchParams.has("page") ? url.searchParams.get("page") : undefined,
    search: url.searchParams.get("search") ?? "",
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid customer query" }, { status: 422 });

  const pageSize = 25;
  const { page, search } = parsed.data;
  const where = search ? {
    OR: [
      { fullName: { contains: search, mode: "insensitive" as const } },
      { phone: { contains: search } },
      { email: { contains: search, mode: "insensitive" as const } },
    ],
  } : {};

  try {
    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          isBlacklisted: true,
          blacklistReason: true,
          createdAt: true,
          _count: { select: { orders: true } },
          orders: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { number: true, status: true, total: true, createdAt: true },
          },
        },
      }),
    ]);

    const customerIds = customers.map((customer) => customer.id);
    const orderStatusCounts = customerIds.length ? await prisma.order.groupBy({
      by: ["customerId", "status"],
      where: { customerId: { in: customerIds } },
      _count: { _all: true },
    }) : [];

    const deliveredByCustomer = new Map<string, number>();
    const returnedByCustomer = new Map<string, number>();
    for (const entry of orderStatusCounts) {
      if (entry.status === "DELIVERED") deliveredByCustomer.set(entry.customerId, entry._count._all);
      if (entry.status === "RETURNED") returnedByCustomer.set(entry.customerId, entry._count._all);
    }

    return NextResponse.json({
      customers: customers.map((customer) => ({
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email,
        isBlacklisted: customer.isBlacklisted,
        blacklistReason: customer.blacklistReason,
        totalOrders: customer._count.orders,
        deliveredOrders: deliveredByCustomer.get(customer.id) ?? 0,
        returnedOrders: returnedByCustomer.get(customer.id) ?? 0,
        createdAt: customer.createdAt,
        latestOrder: customer.orders[0] ?? null,
      })),
      pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Customer lookup failed", error);
    return NextResponse.json({ error: "Unable to load customers" }, { status: 500 });
  }
}