import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, notFound, badRequest } from "@/lib/auth-helpers";
import { handleApiError } from "@/lib/api-helpers";
import {
  generateInvoiceEmail,
  generatePaymentReminderEmail,
  generatePaymentConfirmationEmail,
} from "@/lib/email-templates";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const body = await request.json();
    const { type = "invoice" } = body; // "invoice" | "reminder" | "confirmation"

    const invoice = await prisma.invoice.findFirst({
      where: { id, userId: user.id },
      include: {
        client: true,
        items: true,
        user: {
          select: {
            name: true,
            businessName: true,
            email: true,
          },
        },
        payments: {
          orderBy: { paidAt: "desc" },
        },
      },
    });

    if (!invoice) return notFound("Invoice not found");

    const businessName = invoice.user.businessName || invoice.user.name;
    const paymentLink = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/pay/${invoice.id}`;

    let emailResult: { subject: string; html: string; text: string };

    switch (type) {
      case "reminder": {
        if (invoice.status !== "sent" && invoice.status !== "overdue") {
          return badRequest("Can only send reminders for sent or overdue invoices");
        }

        const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
        const balanceDue = invoice.total - totalPaid;
        const daysOverdue = Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(invoice.dueDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );

        emailResult = generatePaymentReminderEmail({
          invoiceNumber: invoice.number,
          clientName: invoice.client.name,
          clientEmail: invoice.client.email,
          businessName,
          amount: invoice.total,
          balanceDue,
          currency: invoice.currency,
          dueDate: new Date(invoice.dueDate).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
          daysOverdue,
          reminderCount: invoice.reminderCount + 1,
          paymentLink,
        });

        // Update reminder count
        await prisma.invoice.update({
          where: { id },
          data: {
            reminderCount: invoice.reminderCount + 1,
            lastRemindedAt: new Date(),
          },
        });
        break;
      }

      case "confirmation": {
        const lastPayment = invoice.payments[0];
        if (!lastPayment) {
          return badRequest("No payments found for this invoice");
        }

        const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
        const balanceRemaining = invoice.total - totalPaid;

        const methodLabels: Record<string, string> = {
          bank_transfer: "Bank Transfer",
          credit_card: "Credit Card",
          paypal: "PayPal",
          check: "Check",
          cash: "Cash",
          other: "Other",
        };

        emailResult = generatePaymentConfirmationEmail({
          invoiceNumber: invoice.number,
          clientName: invoice.client.name,
          clientEmail: invoice.client.email,
          businessName,
          amountPaid: lastPayment.amount,
          totalAmount: invoice.total,
          balanceRemaining,
          currency: invoice.currency,
          paymentMethod: methodLabels[lastPayment.method] || lastPayment.method,
          paymentDate: new Date(lastPayment.paidAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
          paymentReference: lastPayment.reference || undefined,
        });
        break;
      }

      case "invoice":
      default: {
        if (invoice.status !== "draft" && invoice.status !== "sent") {
          return badRequest("Only draft or sent invoices can be emailed");
        }

        emailResult = generateInvoiceEmail({
          invoiceNumber: invoice.number,
          clientName: invoice.client.name,
          clientEmail: invoice.client.email,
          businessName,
          amount: invoice.total,
          currency: invoice.currency,
          dueDate: new Date(invoice.dueDate).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
          issueDate: new Date(invoice.issueDate).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
          paymentLink,
          items: invoice.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
          })),
        });

        // Update invoice status to sent
        await prisma.invoice.update({
          where: { id },
          data: {
            status: "sent",
            paymentLink,
          },
        });
        break;
      }
    }

    // Mock email sending - log to console
    console.log("\n========================================");
    console.log(`[InvoFlow Email] ${type.toUpperCase()} EMAIL`);
    console.log("========================================");
    console.log(`To: ${invoice.client.email}`);
    console.log(`Subject: ${emailResult.subject}`);
    console.log("----------------------------------------");
    console.log("Plain Text Version:");
    console.log(emailResult.text);
    console.log("----------------------------------------");
    console.log("HTML email generated successfully (check email-templates.ts for template)");
    console.log("========================================\n");

    return NextResponse.json({
      success: true,
      emailType: type,
      recipient: invoice.client.email,
      subject: emailResult.subject,
      message: `${type === "invoice" ? "Invoice" : type === "reminder" ? "Payment reminder" : "Payment confirmation"} email sent to ${invoice.client.email}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
