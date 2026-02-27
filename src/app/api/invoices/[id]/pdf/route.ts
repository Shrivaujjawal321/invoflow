import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, notFound } from "@/lib/auth-helpers";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
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
        user: {
          select: { name: true, email: true, businessName: true, address: true, phone: true, taxId: true },
        },
      },
    });

    if (!invoice) return notFound("Invoice not found");

    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

    const formatDate = (date: Date) =>
      new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const itemRows = invoice.items
      .map(
        (item) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${item.description}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(item.rate)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(item.amount)}</td>
      </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoice.number}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 40px; color: #333; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .invoice-title { font-size: 28px; font-weight: bold; color: #2563eb; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f8fafc; padding: 10px 8px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; }
    .totals { margin-left: auto; width: 280px; }
    .totals td { padding: 6px 8px; }
    .total-row { font-size: 18px; font-weight: bold; border-top: 2px solid #333; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="invoice-title">INVOICE</div>
      <div style="color:#64748b;font-size:16px">${invoice.number}</div>
    </div>
    <div style="text-align:right">
      <div style="font-weight:bold;font-size:18px">${invoice.user.businessName || invoice.user.name}</div>
      ${invoice.user.address ? `<div style="color:#64748b">${invoice.user.address}</div>` : ""}
      ${invoice.user.phone ? `<div style="color:#64748b">${invoice.user.phone}</div>` : ""}
      ${invoice.user.email ? `<div style="color:#64748b">${invoice.user.email}</div>` : ""}
      ${invoice.user.taxId ? `<div style="color:#64748b">Tax ID: ${invoice.user.taxId}</div>` : ""}
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;margin-bottom:30px">
    <div>
      <div style="font-size:11px;text-transform:uppercase;color:#64748b;margin-bottom:4px">Bill To</div>
      ${invoice.client.company ? `<div style="font-weight:bold">${invoice.client.company}</div>` : ""}
      <div>${invoice.client.name}</div>
      <div style="color:#64748b">${invoice.client.email}</div>
      ${invoice.client.phone ? `<div style="color:#64748b">${invoice.client.phone}</div>` : ""}
    </div>
    <div style="text-align:right">
      <div><span style="color:#64748b">Issue Date:</span> ${formatDate(invoice.issueDate)}</div>
      <div><span style="color:#64748b">Due Date:</span> ${formatDate(invoice.dueDate)}</div>
      <div><span style="color:#64748b">Status:</span> ${invoice.status.toUpperCase()}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Rate</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table class="totals">
    <tr><td style="color:#64748b">Subtotal</td><td style="text-align:right">${formatCurrency(invoice.subtotal)}</td></tr>
    <tr><td style="color:#64748b">Tax (${invoice.taxRate}%)</td><td style="text-align:right">${formatCurrency(invoice.tax)}</td></tr>
    <tr class="total-row"><td>Total</td><td style="text-align:right">${formatCurrency(invoice.total)}</td></tr>
  </table>

  ${invoice.notes ? `<div style="margin-top:30px"><div style="font-size:11px;text-transform:uppercase;color:#64748b;margin-bottom:4px">Notes</div><div style="color:#64748b">${invoice.notes}</div></div>` : ""}
  ${invoice.terms ? `<div style="margin-top:15px"><div style="font-size:11px;text-transform:uppercase;color:#64748b;margin-bottom:4px">Terms</div><div style="color:#64748b">${invoice.terms}</div></div>` : ""}

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
