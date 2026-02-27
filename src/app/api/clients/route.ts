import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, badRequest } from "@/lib/auth-helpers";
import { z } from "zod";
import { handleApiError } from "@/lib/api-helpers";

const createClientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const where: Record<string, unknown> = { userId: user.id };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { company: { contains: search } },
      ];
    }

    const clients = await prisma.client.findMany({
      where,
      include: {
        invoices: {
          select: { total: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate totals for each client
    const clientsWithTotals = clients.map((client) => {
      const totalInvoiced = client.invoices.reduce(
        (sum, inv) => sum + inv.total,
        0
      );
      const outstanding = client.invoices
        .filter((inv) => inv.status === "sent" || inv.status === "overdue")
        .reduce((sum, inv) => sum + inv.total, 0);
      const invoiceCount = client.invoices.length;

      return {
        ...client,
        totalInvoiced,
        outstanding,
        invoiceCount,
      };
    });

    return NextResponse.json(clientsWithTotals);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const validation = createClientSchema.safeParse(body);

    if (!validation.success) {
      return badRequest(validation.error.issues[0].message);
    }

    const data = validation.data;

    const client = await prisma.client.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        company: data.company || null,
        address: data.address || null,
        notes: data.notes || null,
        userId: user.id,
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
