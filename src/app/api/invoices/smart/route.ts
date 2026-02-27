import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized, badRequest } from "@/lib/auth-helpers";
import { handleApiError } from "@/lib/api-helpers";
import {
  predictPaymentDate,
  suggestLineItems,
  detectDuplicateInvoice,
} from "@/lib/mock-ai";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "predict-payment": {
        const { clientId, invoiceTotal, dueDate } = body;
        if (!clientId || !invoiceTotal || !dueDate) {
          return badRequest("clientId, invoiceTotal, and dueDate are required");
        }
        const prediction = await predictPaymentDate(
          user.id,
          clientId,
          invoiceTotal,
          new Date(dueDate)
        );
        return NextResponse.json(prediction);
      }

      case "suggest-items": {
        const { clientId, description } = body;
        if (!clientId) {
          return badRequest("clientId is required");
        }
        const suggestions = await suggestLineItems(
          user.id,
          clientId,
          description
        );
        return NextResponse.json(suggestions);
      }

      case "detect-duplicate": {
        const { clientId, total, issueDate, items } = body;
        if (!clientId || total === undefined || !issueDate) {
          return badRequest("clientId, total, and issueDate are required");
        }
        const result = await detectDuplicateInvoice(
          user.id,
          clientId,
          total,
          new Date(issueDate),
          items || []
        );
        return NextResponse.json(result);
      }

      default:
        return badRequest(
          "Invalid action. Use: predict-payment, suggest-items, or detect-duplicate"
        );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
