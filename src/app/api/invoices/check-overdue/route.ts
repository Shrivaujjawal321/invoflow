import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/auth-helpers";
import { handleApiError } from "@/lib/api-helpers";

export async function checkOverdueInvoices(userId: string): Promise<number> {
  const now = new Date();
  const result = await prisma.invoice.updateMany({
    where: {
      userId,
      status: "sent",
      dueDate: { lt: now },
    },
    data: { status: "overdue" },
  });
  return result.count;
}

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const count = await checkOverdueInvoices(user.id);

    return NextResponse.json({
      success: true,
      overdueCount: count,
      message: count > 0
        ? `${count} invoice(s) marked as overdue`
        : "No new overdue invoices found",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
