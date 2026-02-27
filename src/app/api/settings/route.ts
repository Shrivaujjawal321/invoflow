import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, badRequest } from "@/lib/auth-helpers";
import { z } from "zod";
import { handleApiError } from "@/lib/api-helpers";

const updateSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  businessName: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        businessName: true,
        address: true,
        phone: true,
        taxId: true,
      },
    });

    return NextResponse.json(userData);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const validation = updateSettingsSchema.safeParse(body);

    if (!validation.success) {
      return badRequest(validation.error.issues[0].message);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: validation.data,
      select: {
        id: true,
        email: true,
        name: true,
        businessName: true,
        address: true,
        phone: true,
        taxId: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
