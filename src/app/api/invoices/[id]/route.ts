import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, notFound, badRequest } from "@/lib/auth-helpers";
import { z } from "zod";
import { handleApiError } from "@/lib/api-helpers";

const updateInvoiceSchema = z.object({
  clientId: z.string().min(1).optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  currency: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        rate: z.number().min(0),
      })
    )
    .optional(),
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
      include: {
        client: true,
        items: true,
        payments: {
          orderBy: { paidAt: "desc" },
        },
        user: {
          select: {
            name: true,
            businessName: true,
            address: true,
            phone: true,
            email: true,
            taxId: true,
          },
        },
      },
    });

    if (!invoice) return notFound("Invoice not found");

    return NextResponse.json(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { id } = await params;

    const existing = await prisma.invoice.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) return notFound("Invoice not found");

    const body = await request.json();
    const validation = updateInvoiceSchema.safeParse(body);

    if (!validation.success) {
      return badRequest(validation.error.issues[0].message);
    }

    const data = validation.data;

    // If items are provided, recalculate totals
    let updateData: Record<string, unknown> = {};

    if (data.clientId) updateData.clientId = data.clientId;
    if (data.issueDate) updateData.issueDate = new Date(data.issueDate);
    if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.terms !== undefined) updateData.terms = data.terms;
    if (data.currency) updateData.currency = data.currency;
    if (data.status) updateData.status = data.status;

    if (data.items) {
      const taxRate = data.taxRate ?? existing.taxRate;
      const items = data.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.quantity * item.rate,
      }));

      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
      const tax = subtotal * (taxRate / 100);
      const total = subtotal + tax;

      updateData.subtotal = subtotal;
      updateData.tax = tax;
      updateData.taxRate = taxRate;
      updateData.total = total;

      // Delete existing items and create new ones
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });

      const invoice = await prisma.invoice.update({
        where: { id },
        data: {
          ...updateData,
          items: {
            create: items,
          },
        },
        include: {
          client: true,
          items: true,
        },
      });

      return NextResponse.json(invoice);
    }

    if (data.taxRate !== undefined && !data.items) {
      const subtotal = existing.subtotal;
      const tax = subtotal * (data.taxRate / 100);
      const total = subtotal + tax;
      updateData.taxRate = data.taxRate;
      updateData.tax = tax;
      updateData.total = total;
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        items: true,
      },
    });

    return NextResponse.json(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { id } = await params;

    const existing = await prisma.invoice.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) return notFound("Invoice not found");

    // Delete payments first
    await prisma.payment.deleteMany({ where: { invoiceId: id } });
    // Items are cascade deleted
    await prisma.invoice.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
