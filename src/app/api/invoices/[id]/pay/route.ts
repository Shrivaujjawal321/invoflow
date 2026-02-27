import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-helpers";

// GET - Returns payment page data (public - no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: {
          select: { name: true, company: true, email: true },
        },
        items: true,
        user: {
          select: {
            name: true,
            businessName: true,
            email: true,
          },
        },
        payments: {
          select: { amount: true },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "cancelled") {
      return NextResponse.json(
        { error: "This invoice has been cancelled" },
        { status: 400 }
      );
    }

    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const balanceDue = invoice.total - totalPaid;

    return NextResponse.json({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      subtotal: invoice.subtotal,
      taxRate: invoice.taxRate,
      tax: invoice.tax,
      total: invoice.total,
      currency: invoice.currency,
      notes: invoice.notes,
      terms: invoice.terms,
      totalPaid,
      balanceDue,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
      })),
      client: invoice.client,
      business: {
        name: invoice.user.businessName || invoice.user.name,
        email: invoice.user.email,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST - Processes mock payment (public - no auth required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await request.json();
    const { method, payerEmail, payerName } = body;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        payments: { select: { amount: true } },
        client: { select: { name: true, email: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "paid") {
      return NextResponse.json(
        { error: "This invoice has already been paid" },
        { status: 400 }
      );
    }

    if (invoice.status === "cancelled") {
      return NextResponse.json(
        { error: "This invoice has been cancelled" },
        { status: 400 }
      );
    }

    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const balanceDue = invoice.total - totalPaid;

    if (balanceDue <= 0) {
      return NextResponse.json(
        { error: "No balance due on this invoice" },
        { status: 400 }
      );
    }

    // Mock payment processing - simulate a brief delay
    const mockGatewayId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    // Create the payment record
    const payment = await prisma.payment.create({
      data: {
        invoiceId: id,
        amount: balanceDue,
        method: method || "credit_card",
        gateway: "online",
        gatewayPaymentId: mockGatewayId,
        reference: `Online payment by ${payerName || invoice.client.name}`,
        status: "completed",
        paidAt: new Date(),
      },
    });

    // Update invoice status to paid
    await prisma.invoice.update({
      where: { id },
      data: { status: "paid" },
    });

    // Log mock payment confirmation
    console.log(`[InvoFlow] Online payment received for ${invoice.number}`);
    console.log(`  Amount: $${balanceDue.toFixed(2)}`);
    console.log(`  Payer: ${payerName || invoice.client.name} (${payerEmail || invoice.client.email})`);
    console.log(`  Method: ${method || "credit_card"}`);
    console.log(`  Gateway ID: ${mockGatewayId}`);

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount,
        gatewayPaymentId: mockGatewayId,
        method: payment.method,
      },
      message: "Payment processed successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
