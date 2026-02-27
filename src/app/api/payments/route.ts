import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/auth-helpers";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = {
      invoice: { userId: user.id },
    };

    if (from || to) {
      where.paidAt = {};
      if (from) (where.paidAt as Record<string, Date>).gte = new Date(from);
      if (to) (where.paidAt as Record<string, Date>).lte = new Date(to);
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        invoice: {
          select: {
            number: true,
            client: {
              select: { name: true, company: true },
            },
          },
        },
      },
      orderBy: { paidAt: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error) {
    return handleApiError(error);
  }
}
