import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/auth-helpers";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    // Revenue by month (last 12 months)
    const now = new Date();
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

    return NextResponse.json({
      revenueByMonth: Object.entries(revenueByMonth).map(([month, amount]) => ({
        month,
        amount,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
