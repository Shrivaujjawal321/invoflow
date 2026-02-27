import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, badRequest } from "@/lib/auth-helpers";
import { z } from "zod";
import { handleApiError } from "@/lib/api-helpers";

const createInvoiceSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  issueDate: z.string(),
  dueDate: z.string(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  currency: z.string().default("USD"),
  taxRate: z.number().min(0).max(100).default(0),
  status: z.enum(["draft", "sent"]).default("draft"),
  items: z
    .array(
      z.object({
        description: z.string().min(1, "Description is required"),
        quantity: z.number().positive("Quantity must be positive"),
        rate: z.number().min(0, "Rate must be non-negative"),
      })
    )
    .min(1, "At least one item is required"),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = { userId: user.id };

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { number: { contains: search } },
        { client: { name: { contains: search } } },
        { client: { company: { contains: search } } },
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        client: { select: { name: true, company: true, email: true } },
        _count: { select: { payments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const validation = createInvoiceSchema.safeParse(body);

    if (!validation.success) {
      return badRequest(validation.error.issues[0].message);
    }

    const data = validation.data;

    // Generate invoice number
    const lastInvoice = await prisma.invoice.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { number: true },
    });

    let nextNumber = 1;
    if (lastInvoice) {
      const match = lastInvoice.number.match(/INV-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    const invoiceNumber = `INV-${String(nextNumber).padStart(3, "0")}`;

    // Calculate totals
    const items = data.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.quantity * item.rate,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const tax = subtotal * (data.taxRate / 100);
    const total = subtotal + tax;

    const invoice = await prisma.invoice.create({
      data: {
        number: invoiceNumber,
        status: data.status,
        issueDate: new Date(data.issueDate),
        dueDate: new Date(data.dueDate),
        subtotal,
        tax,
        taxRate: data.taxRate,
        total,
        notes: data.notes || null,
        terms: data.terms || null,
        currency: data.currency,
        clientId: data.clientId,
        userId: user.id,
        items: {
          create: items,
        },
      },
      include: {
        client: true,
        items: true,
      },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
