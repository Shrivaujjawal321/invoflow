import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, notFound, badRequest } from "@/lib/auth-helpers";
import { z } from "zod";
import { handleApiError } from "@/lib/api-helpers";

const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { id } = await params;

    const client = await prisma.client.findFirst({
      where: { id, userId: user.id },
      include: {
        invoices: {
          include: {
            _count: { select: { payments: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!client) return notFound("Client not found");

    return NextResponse.json(client);
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

    const existing = await prisma.client.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) return notFound("Client not found");

    const body = await request.json();
    const validation = updateClientSchema.safeParse(body);

    if (!validation.success) {
      return badRequest(validation.error.issues[0].message);
    }

    const client = await prisma.client.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json(client);
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

    const existing = await prisma.client.findFirst({
      where: { id, userId: user.id },
      include: { _count: { select: { invoices: true } } },
    });

    if (!existing) return notFound("Client not found");

    if (existing._count.invoices > 0) {
      return badRequest("Cannot delete client with existing invoices");
    }

    await prisma.client.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
