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

    if (invoice.status !== "draft" && invoice.status !== "sent") {
      return badRequest("Only draft or sent invoices can be sent");
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: "sent" },
      include: { client: true },
    });

    // Log the send action (in production, this would send an email)
    console.log(`[InvoFlow] Invoice ${invoice.number} sent to ${invoice.client.email}`);
    console.log(`  Amount: $${invoice.total.toFixed(2)}`);
    console.log(`  Due: ${invoice.dueDate.toISOString().split("T")[0]}`);

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
