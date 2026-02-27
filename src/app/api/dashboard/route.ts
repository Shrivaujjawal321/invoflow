import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/auth-helpers";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Total revenue from all paid invoices
    const paidInvoices = await prisma.invoice.findMany({
      where: { userId: user.id, status: "paid" },
      select: { total: true },
    });
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);

    // Outstanding amount (sent + overdue invoices minus partial payments)
    const outstandingInvoices = await prisma.invoice.findMany({
      where: {
        userId: user.id,
        status: { in: ["sent", "overdue"] },
      },
      select: { id: true, total: true },
    });
    let outstanding = 0;
    for (const inv of outstandingInvoices) {
      const payments = await prisma.payment.aggregate({
        where: { invoiceId: inv.id },
        _sum: { amount: true },
      });
      outstanding += inv.total - (payments._sum.amount || 0);
    }

    // Overdue amount
    const overdueInvoices = await prisma.invoice.findMany({
      where: { userId: user.id, status: "overdue" },
      select: { id: true, total: true },
    });
    let overdue = 0;
    for (const inv of overdueInvoices) {
      const payments = await prisma.payment.aggregate({
        where: { invoiceId: inv.id },
        _sum: { amount: true },
      });
      overdue += inv.total - (payments._sum.amount || 0);
    }

    // Paid this month
    const paidThisMonth = await prisma.payment.aggregate({
      where: {
        invoice: { userId: user.id },
        paidAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: { amount: true },
    });

    // Recent invoices
    const recentInvoices = await prisma.invoice.findMany({
      where: { userId: user.id },
      include: { client: { select: { name: true, company: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Invoice count by status
    const statusCounts = await prisma.invoice.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { id: true },
    });

    return NextResponse.json({
      stats: {
        totalRevenue,
        outstanding,
        overdue,
        paidThisMonth: paidThisMonth._sum.amount || 0,
      },
      recentInvoices,
      statusCounts: statusCounts.reduce(
        (acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        },
        {} as Record<string, number>
      ),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
