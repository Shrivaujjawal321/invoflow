import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, notFound, badRequest } from "@/lib/auth-helpers";
import { z } from "zod";
import { handleApiError } from "@/lib/api-helpers";

const createPaymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  method: z.enum(["bank_transfer", "credit_card", "paypal", "check", "cash", "other"]),
  reference: z.string().optional(),
  paidAt: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, userId: user.id },
    });

    if (!invoice) return notFound("Invoice not found");

    const payments = await prisma.payment.findMany({
      where: { invoiceId: id },
      orderBy: { paidAt: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error) {
    return handleApiError(error);
  }
}

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
    });

    if (!invoice) return notFound("Invoice not found");

    const body = await request.json();
    const validation = createPaymentSchema.safeParse(body);

    if (!validation.success) {
      return badRequest(validation.error.issues[0].message);
    }

    const data = validation.data;

    // Check total paid so far
    const existingPayments = await prisma.payment.aggregate({
      where: { invoiceId: id },
      _sum: { amount: true },
    });

    const totalPaid = (existingPayments._sum.amount || 0) + data.amount;

    if (totalPaid > invoice.total) {
      return badRequest("Payment amount exceeds remaining balance");
    }

    const payment = await prisma.payment.create({
      data: {
        amount: data.amount,
        method: data.method,
        reference: data.reference || null,
        paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
        invoiceId: id,
      },
    });

    // If fully paid, update invoice status
    if (Math.abs(totalPaid - invoice.total) < 0.01) {
      await prisma.invoice.update({
        where: { id },
        data: { status: "paid" },
      });
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
