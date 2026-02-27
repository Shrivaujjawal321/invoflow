import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, notFound } from "@/lib/auth-helpers";
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
      include: { items: true },
    });

    if (!invoice) return notFound("Invoice not found");

    // Generate new invoice number using transaction
    const result = await prisma.$transaction(async (tx) => {
      const userData = await tx.user.findUnique({
        where: { id: user.id },
        select: { invoiceCounter: true },
      });

      const nextCounter = (userData?.invoiceCounter || 0) + 1;
      const invoiceNumber = `INV-${String(nextCounter).padStart(3, "0")}`;

      await tx.user.update({
        where: { id: user.id },
        data: { invoiceCounter: nextCounter },
      });

      const now = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const newInvoice = await tx.invoice.create({
        data: {
          number: invoiceNumber,
          status: "draft",
          issueDate: now,
          dueDate: dueDate,
          subtotal: invoice.subtotal,
          taxRate: invoice.taxRate,
          tax: invoice.tax,
          total: invoice.total,
          notes: invoice.notes,
          terms: invoice.terms,
          currency: invoice.currency,
          clientId: invoice.clientId,
          userId: user.id,
          items: {
            create: invoice.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
            })),
          },
        },
        include: {
          client: true,
          items: true,
        },
      });

      return newInvoice;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
