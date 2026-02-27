import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, badRequest } from "@/lib/auth-helpers";
import { z } from "zod";
import { handleApiError } from "@/lib/api-helpers";

const createRecurringSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  frequency: z.enum(["weekly", "monthly", "quarterly"]),
  nextDate: z.string().min(1, "Next date is required"),
  items: z
    .array(
      z.object({
        description: z.string().min(1, "Description is required"),
        quantity: z.number().positive("Quantity must be positive"),
        rate: z.number().min(0, "Rate must be non-negative"),
      })
    )
    .min(1, "At least one item is required"),
  notes: z.string().optional(),
  terms: z.string().optional(),
  taxRate: z.number().min(0).max(100).default(0),
  currency: z.string().default("USD"),
});

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const recurring = await prisma.recurringInvoice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with client data
    const clientIds = [...new Set(recurring.map((r) => r.clientId))];
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, company: true, email: true },
    });
    const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));

    const enriched = recurring.map((r) => {
      let templateData;
      try {
        templateData = JSON.parse(r.templateData);
      } catch {
        templateData = {};
      }
      return {
        id: r.id,
        clientId: r.clientId,
        client: clientMap[r.clientId] || null,
        frequency: r.frequency,
        nextDate: r.nextDate,
        active: r.active,
        templateData,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const validation = createRecurringSchema.safeParse(body);

    if (!validation.success) {
      return badRequest(validation.error.issues[0].message);
    }

    const data = validation.data;

    // Verify client belongs to user
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, userId: user.id },
    });

    if (!client) {
      return badRequest("Client not found");
    }

    const templateData = JSON.stringify({
      items: data.items,
      notes: data.notes || null,
      terms: data.terms || null,
      taxRate: data.taxRate,
      currency: data.currency,
    });

    const recurring = await prisma.recurringInvoice.create({
      data: {
        userId: user.id,
        clientId: data.clientId,
        frequency: data.frequency,
        nextDate: new Date(data.nextDate),
        active: true,
        templateData,
      },
    });

    console.log(`[InvoFlow] Recurring invoice created for client ${client.name}`);
    console.log(`  Frequency: ${data.frequency}`);
    console.log(`  Next date: ${data.nextDate}`);

    return NextResponse.json(
      {
        ...recurring,
        client: { name: client.name, company: client.company, email: client.email },
        templateData: JSON.parse(recurring.templateData),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const { id, active, frequency, nextDate } = body;

    if (!id) return badRequest("Recurring invoice ID is required");

    const existing = await prisma.recurringInvoice.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (typeof active === "boolean") updateData.active = active;
    if (frequency) updateData.frequency = frequency;
    if (nextDate) updateData.nextDate = new Date(nextDate);

    const updated = await prisma.recurringInvoice.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      templateData: JSON.parse(updated.templateData),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return badRequest("Recurring invoice ID is required");

    const existing = await prisma.recurringInvoice.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.recurringInvoice.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
