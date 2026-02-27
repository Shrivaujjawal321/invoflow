import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/auth-helpers";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const now = new Date();

    // 1. Monthly revenue (last 12 months)
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const payments = await prisma.payment.findMany({
      where: {
        invoice: { userId: user.id },
        status: "completed",
        paidAt: { gte: twelveMonthsAgo },
      },
      select: { amount: true, paidAt: true },
    });

    const revenueByMonth: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
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

    // 2. Revenue by client (top 10)
    const paidInvoices = await prisma.invoice.findMany({
      where: { userId: user.id, status: "paid" },
      include: {
        client: { select: { name: true, company: true } },
        payments: { select: { amount: true } },
      },
    });

    const revenueByClient: Record<string, number> = {};
    paidInvoices.forEach((inv) => {
      const name = inv.client.company || inv.client.name;
      const paidAmount = inv.payments.reduce((sum, p) => sum + p.amount, 0);
      revenueByClient[name] = (revenueByClient[name] || 0) + paidAmount;
    });

    const topClients = Object.entries(revenueByClient)
      .map(([client, amount]) => ({ client, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // 3. Invoice status breakdown
    const statusCounts = await prisma.invoice.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { id: true },
      _sum: { total: true },
    });

    // 4. Average payment time (days between invoice issue date and payment date)
    const paidInvoicesWithPayments = await prisma.invoice.findMany({
      where: { userId: user.id, status: "paid" },
      select: {
        issueDate: true,
        payments: {
          select: { paidAt: true },
          orderBy: { paidAt: "asc" },
          take: 1,
        },
      },
    });

    let totalPaymentDays = 0;
    let paymentDaysCount = 0;

    paidInvoicesWithPayments.forEach((inv) => {
      if (inv.payments.length > 0) {
        const issueDate = new Date(inv.issueDate).getTime();
        const paymentDate = new Date(inv.payments[0].paidAt).getTime();
        const days = Math.max(0, (paymentDate - issueDate) / (1000 * 60 * 60 * 24));
        totalPaymentDays += days;
        paymentDaysCount++;
      }
    });

    const avgPaymentDays =
      paymentDaysCount > 0 ? Math.round(totalPaymentDays / paymentDaysCount) : 0;

    // 5. Outstanding amount summary
    const outstandingInvoices = await prisma.invoice.findMany({
      where: {
        userId: user.id,
        status: { in: ["sent", "overdue"] },
      },
      include: {
        payments: { select: { amount: true } },
      },
    });

    let totalOutstanding = 0;
    let overdueAmount = 0;
    let sentAmount = 0;
    outstandingInvoices.forEach((inv) => {
      const paid = inv.payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = inv.total - paid;
      totalOutstanding += remaining;
      if (inv.status === "overdue") {
        overdueAmount += remaining;
      } else {
        sentAmount += remaining;
      }
    });

    // Total revenue
    const allPayments = await prisma.payment.aggregate({
      where: { invoice: { userId: user.id }, status: "completed" },
      _sum: { amount: true },
    });

    const totalInvoiced = await prisma.invoice.aggregate({
      where: { userId: user.id },
      _sum: { total: true },
      _count: { id: true },
    });

    return NextResponse.json({
      revenueByMonth: Object.entries(revenueByMonth).map(([month, amount]) => ({
        month,
        amount,
      })),
      revenueByClient: topClients,
      statusBreakdown: statusCounts.map((s) => ({
        status: s.status,
        count: s._count.id,
        total: s._sum.total || 0,
      })),
      avgPaymentDays,
      outstanding: {
        total: totalOutstanding,
        overdue: overdueAmount,
        sent: sentAmount,
        invoiceCount: outstandingInvoices.length,
      },
      summary: {
        totalRevenue: allPayments._sum.amount || 0,
        totalInvoiced: totalInvoiced._sum.total || 0,
        invoiceCount: totalInvoiced._count.id,
        collectionRate:
          (totalInvoiced._sum.total || 0) > 0
            ? ((allPayments._sum.amount || 0) /
                (totalInvoiced._sum.total || 0)) *
              100
            : 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
