// Email template types and generators for InvoFlow
// In production, these would integrate with an email service like SendGrid, Resend, etc.

interface InvoiceEmailData {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  businessName: string;
  amount: number;
  currency: string;
  dueDate: string;
  issueDate: string;
  paymentLink?: string;
  items: { description: string; quantity: number; rate: number; amount: number }[];
}

interface PaymentReminderData {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  businessName: string;
  amount: number;
  balanceDue: number;
  currency: string;
  dueDate: string;
  daysOverdue: number;
  reminderCount: number;
  paymentLink?: string;
}

interface PaymentConfirmationData {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  businessName: string;
  amountPaid: number;
  totalAmount: number;
  balanceRemaining: number;
  currency: string;
  paymentMethod: string;
  paymentDate: string;
  paymentReference?: string;
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generate an invoice email template
 * Returns subject and HTML body for sending to the client
 */
export function generateInvoiceEmail(data: InvoiceEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Invoice ${data.invoiceNumber} from ${data.businessName} - ${formatCurrency(data.amount, data.currency)}`;

  const itemRows = data.items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.rate, data.currency)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.amount, data.currency)}</td>
        </tr>`
    )
    .join("");

  const paymentButton = data.paymentLink
    ? `<div style="text-align: center; margin: 24px 0;">
        <a href="${data.paymentLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Pay Now - ${formatCurrency(data.amount, data.currency)}
        </a>
       </div>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #e5e7eb;">
    <h1 style="margin: 0; color: #2563eb; font-size: 24px;">${data.businessName}</h1>
  </div>

  <div style="padding: 24px 0;">
    <p>Hello ${data.clientName},</p>
    <p>Please find your invoice <strong>${data.invoiceNumber}</strong> attached below.</p>

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="color: #6b7280;">Invoice Number</td>
          <td style="text-align: right; font-weight: 600;">${data.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Issue Date</td>
          <td style="text-align: right;">${data.issueDate}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Due Date</td>
          <td style="text-align: right; font-weight: 600;">${data.dueDate}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Amount Due</td>
          <td style="text-align: right; font-weight: 700; font-size: 18px; color: #2563eb;">${formatCurrency(data.amount, data.currency)}</td>
        </tr>
      </table>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 16px 0;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 8px 12px; text-align: left;">Description</th>
          <th style="padding: 8px 12px; text-align: center;">Qty</th>
          <th style="padding: 8px 12px; text-align: right;">Rate</th>
          <th style="padding: 8px 12px; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    ${paymentButton}

    <p style="color: #6b7280; font-size: 14px;">
      Payment is due by <strong>${data.dueDate}</strong>. Please ensure timely payment to avoid any late fees.
    </p>

    <p>Thank you for your business!</p>
    <p style="color: #6b7280;">-- ${data.businessName}</p>
  </div>

  <div style="border-top: 1px solid #e5e7eb; padding: 16px 0; text-align: center; font-size: 12px; color: #9ca3af;">
    Sent via InvoFlow
  </div>
</body>
</html>`;

  const text = `
Invoice ${data.invoiceNumber} from ${data.businessName}

Hello ${data.clientName},

Please find your invoice details below:

Invoice Number: ${data.invoiceNumber}
Issue Date: ${data.issueDate}
Due Date: ${data.dueDate}
Amount Due: ${formatCurrency(data.amount, data.currency)}

Items:
${data.items.map((item) => `- ${item.description}: ${item.quantity} x ${formatCurrency(item.rate, data.currency)} = ${formatCurrency(item.amount, data.currency)}`).join("\n")}

${data.paymentLink ? `Pay online: ${data.paymentLink}` : ""}

Payment is due by ${data.dueDate}. Please ensure timely payment.

Thank you for your business!
${data.businessName}
`.trim();

  return { subject, html, text };
}

/**
 * Generate a payment reminder email template
 */
export function generatePaymentReminderEmail(data: PaymentReminderData): {
  subject: string;
  html: string;
  text: string;
} {
  const isOverdue = data.daysOverdue > 0;
  const urgency = data.reminderCount >= 3 ? "Final" : data.reminderCount >= 2 ? "Second" : "Friendly";

  const subject = isOverdue
    ? `${urgency} Reminder: Invoice ${data.invoiceNumber} is ${data.daysOverdue} day${data.daysOverdue !== 1 ? "s" : ""} overdue`
    : `Payment Reminder: Invoice ${data.invoiceNumber} from ${data.businessName}`;

  const paymentButton = data.paymentLink
    ? `<div style="text-align: center; margin: 24px 0;">
        <a href="${data.paymentLink}" style="display: inline-block; background-color: ${isOverdue ? "#dc2626" : "#2563eb"}; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Pay Now - ${formatCurrency(data.balanceDue, data.currency)}
        </a>
       </div>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid ${isOverdue ? "#fecaca" : "#e5e7eb"};">
    <h1 style="margin: 0; color: ${isOverdue ? "#dc2626" : "#2563eb"}; font-size: 24px;">Payment Reminder</h1>
  </div>

  <div style="padding: 24px 0;">
    <p>Hello ${data.clientName},</p>

    ${
      isOverdue
        ? `<p>This is a <strong>${urgency.toLowerCase()} reminder</strong> that invoice <strong>${data.invoiceNumber}</strong> is now <strong style="color: #dc2626;">${data.daysOverdue} day${data.daysOverdue !== 1 ? "s" : ""} past due</strong>.</p>`
        : `<p>This is a friendly reminder that invoice <strong>${data.invoiceNumber}</strong> is due on <strong>${data.dueDate}</strong>.</p>`
    }

    <div style="background-color: ${isOverdue ? "#fef2f2" : "#f9fafb"}; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid ${isOverdue ? "#fecaca" : "#e5e7eb"};">
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="color: #6b7280;">Invoice Number</td>
          <td style="text-align: right; font-weight: 600;">${data.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Original Amount</td>
          <td style="text-align: right;">${formatCurrency(data.amount, data.currency)}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Balance Due</td>
          <td style="text-align: right; font-weight: 700; font-size: 18px; color: ${isOverdue ? "#dc2626" : "#2563eb"};">${formatCurrency(data.balanceDue, data.currency)}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Due Date</td>
          <td style="text-align: right; ${isOverdue ? "color: #dc2626; font-weight: 600;" : ""}">${data.dueDate}</td>
        </tr>
      </table>
    </div>

    ${paymentButton}

    <p style="color: #6b7280; font-size: 14px;">
      If you have already made this payment, please disregard this reminder. If you have any questions, please don't hesitate to reach out.
    </p>

    <p>Thank you,</p>
    <p style="color: #6b7280;">-- ${data.businessName}</p>
  </div>

  <div style="border-top: 1px solid #e5e7eb; padding: 16px 0; text-align: center; font-size: 12px; color: #9ca3af;">
    Reminder ${data.reminderCount} - Sent via InvoFlow
  </div>
</body>
</html>`;

  const text = `
Payment Reminder - Invoice ${data.invoiceNumber}

Hello ${data.clientName},

${isOverdue ? `This is a ${urgency.toLowerCase()} reminder that invoice ${data.invoiceNumber} is now ${data.daysOverdue} days past due.` : `This is a friendly reminder that invoice ${data.invoiceNumber} is due on ${data.dueDate}.`}

Invoice Number: ${data.invoiceNumber}
Original Amount: ${formatCurrency(data.amount, data.currency)}
Balance Due: ${formatCurrency(data.balanceDue, data.currency)}
Due Date: ${data.dueDate}

${data.paymentLink ? `Pay online: ${data.paymentLink}` : ""}

If you have already made this payment, please disregard this reminder.

Thank you,
${data.businessName}
`.trim();

  return { subject, html, text };
}

/**
 * Generate a payment confirmation email template
 */
export function generatePaymentConfirmationEmail(data: PaymentConfirmationData): {
  subject: string;
  html: string;
  text: string;
} {
  const isFullyPaid = data.balanceRemaining <= 0;

  const subject = isFullyPaid
    ? `Payment Received - Invoice ${data.invoiceNumber} is Paid in Full`
    : `Payment Received - ${formatCurrency(data.amountPaid, data.currency)} for Invoice ${data.invoiceNumber}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #d1fae5;">
    <div style="display: inline-block; background-color: #d1fae5; border-radius: 50%; padding: 12px; margin-bottom: 8px;">
      <span style="font-size: 24px;">&#10003;</span>
    </div>
    <h1 style="margin: 8px 0 0; color: #059669; font-size: 24px;">Payment Confirmed</h1>
  </div>

  <div style="padding: 24px 0;">
    <p>Hello ${data.clientName},</p>
    <p>We have received your payment for invoice <strong>${data.invoiceNumber}</strong>. Thank you!</p>

    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #bbf7d0;">
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="color: #6b7280;">Invoice Number</td>
          <td style="text-align: right; font-weight: 600;">${data.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Amount Paid</td>
          <td style="text-align: right; font-weight: 700; font-size: 18px; color: #059669;">${formatCurrency(data.amountPaid, data.currency)}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Payment Date</td>
          <td style="text-align: right;">${data.paymentDate}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Payment Method</td>
          <td style="text-align: right;">${data.paymentMethod}</td>
        </tr>
        ${data.paymentReference ? `<tr><td style="color: #6b7280;">Reference</td><td style="text-align: right; font-family: monospace;">${data.paymentReference}</td></tr>` : ""}
        <tr>
          <td style="color: #6b7280;">Invoice Total</td>
          <td style="text-align: right;">${formatCurrency(data.totalAmount, data.currency)}</td>
        </tr>
        ${
          !isFullyPaid
            ? `<tr><td style="color: #6b7280;">Remaining Balance</td><td style="text-align: right; color: #dc2626; font-weight: 600;">${formatCurrency(data.balanceRemaining, data.currency)}</td></tr>`
            : `<tr><td style="color: #059669; font-weight: 600;">Status</td><td style="text-align: right; color: #059669; font-weight: 700;">PAID IN FULL</td></tr>`
        }
      </table>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Please keep this email as your receipt. ${!isFullyPaid ? `The remaining balance of ${formatCurrency(data.balanceRemaining, data.currency)} is still outstanding.` : ""}
    </p>

    <p>Thank you for your prompt payment!</p>
    <p style="color: #6b7280;">-- ${data.businessName}</p>
  </div>

  <div style="border-top: 1px solid #e5e7eb; padding: 16px 0; text-align: center; font-size: 12px; color: #9ca3af;">
    Sent via InvoFlow
  </div>
</body>
</html>`;

  const text = `
Payment Confirmed - Invoice ${data.invoiceNumber}

Hello ${data.clientName},

We have received your payment for invoice ${data.invoiceNumber}. Thank you!

Amount Paid: ${formatCurrency(data.amountPaid, data.currency)}
Payment Date: ${data.paymentDate}
Payment Method: ${data.paymentMethod}
${data.paymentReference ? `Reference: ${data.paymentReference}` : ""}
Invoice Total: ${formatCurrency(data.totalAmount, data.currency)}
${isFullyPaid ? "Status: PAID IN FULL" : `Remaining Balance: ${formatCurrency(data.balanceRemaining, data.currency)}`}

Please keep this email as your receipt.

Thank you for your prompt payment!
${data.businessName}
`.trim();

  return { subject, html, text };
}
