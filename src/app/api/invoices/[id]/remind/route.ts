import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, notFound, badRequest } from "@/lib/auth-helpers";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, userId: user.id },
      include: { client: true },
    });

    if (!invoice) return notFound("Invoice not found");

    if (invoice.status !== "sent" && invoice.status !== "overdue") {
      return badRequest("Can only send reminders for sent or overdue invoices");
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        reminderCount: invoice.reminderCount + 1,
        lastRemindedAt: new Date(),
      },
      include: { client: true },
    });

    // Mock: Log the reminder (in production, this would send an email/WhatsApp)
    console.log(`[InvoFlow] Payment reminder sent for ${invoice.number}`);
    console.log(`  To: ${invoice.client.email}`);
    console.log(`  Amount: $${invoice.total.toFixed(2)}`);
    console.log(`  Due: ${invoice.dueDate.toISOString().split("T")[0]}`);
    console.log(`  Reminder #${updated.reminderCount}`);

    return NextResponse.json({
      success: true,
      reminderCount: updated.reminderCount,
      message: `Reminder sent to ${invoice.client.email}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
