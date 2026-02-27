import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/auth-helpers";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    // Revenue by month (last 6 months)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const payments = await prisma.payment.findMany({
      where: {
        invoice: { userId: user.id },
        paidAt: { gte: sixMonthsAgo },
      },
      select: { amount: true, paidAt: true },
    });

    const revenueByMonth: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      revenueByMonth[key] = 0;
    }

    payments.forEach((p) => {
      const key = new Date(p.paidAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      if (revenueByMonth[key] !== undefined) {
        revenueByMonth[key] += p.amount;
      }
    });

    // Revenue by client
    const invoicesWithClients = await prisma.invoice.findMany({
      where: { userId: user.id, status: "paid" },
      include: {
        client: { select: { name: true, company: true } },
      },
    });

    const revenueByClient: Record<string, number> = {};
    invoicesWithClients.forEach((inv) => {
      const name = inv.client.company || inv.client.name;
      revenueByClient[name] = (revenueByClient[name] || 0) + inv.total;
    });

    // Invoice status distribution
    const statusCounts = await prisma.invoice.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { id: true },
      _sum: { total: true },
    });

    // Payment methods distribution
    const allPayments = await prisma.payment.findMany({
      where: { invoice: { userId: user.id } },
      select: { method: true, amount: true },
    });

    const methodDistribution: Record<string, number> = {};
    allPayments.forEach((p) => {
      methodDistribution[p.method] =
        (methodDistribution[p.method] || 0) + p.amount;
    });

    // Summary stats
    const totalInvoiced = await prisma.invoice.aggregate({
      where: { userId: user.id },
      _sum: { total: true },
      _count: { id: true },
    });

    const totalPaid = await prisma.payment.aggregate({
      where: { invoice: { userId: user.id } },
      _sum: { amount: true },
    });

    return NextResponse.json({
      revenueByMonth: Object.entries(revenueByMonth).map(([month, amount]) => ({
        month,
        amount,
      })),
      revenueByClient: Object.entries(revenueByClient)
        .map(([client, amount]) => ({ client, amount }))
        .sort((a, b) => b.amount - a.amount),
      statusDistribution: statusCounts.map((s) => ({
        status: s.status,
        count: s._count.id,
        total: s._sum.total || 0,
      })),
      methodDistribution: Object.entries(methodDistribution).map(
        ([method, amount]) => ({ method, amount })
      ),
      summary: {
        totalInvoiced: totalInvoiced._sum.total || 0,
        totalPaid: totalPaid._sum.amount || 0,
        invoiceCount: totalInvoiced._count.id,
        avgInvoiceValue:
          totalInvoiced._count.id > 0
            ? (totalInvoiced._sum.total || 0) / totalInvoiced._count.id
            : 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
