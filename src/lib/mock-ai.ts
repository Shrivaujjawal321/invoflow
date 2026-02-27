// Mock AI / Smart Features for InvoFlow
// These functions simulate AI-powered predictions and suggestions
// In production, these would integrate with actual ML models or AI APIs

import { prisma } from "@/lib/prisma";

interface PaymentPrediction {
  predictedDate: string;
  confidence: number; // 0-100
  reasoning: string;
  avgDaysToPayForClient: number;
  riskLevel: "low" | "medium" | "high";
}

interface LineItemSuggestion {
  description: string;
  quantity: number;
  rate: number;
  frequency: number; // how many times this item has been used
  confidence: number;
}

interface DuplicateCheck {
  isDuplicate: boolean;
  confidence: number;
  similarInvoices: {
    id: string;
    number: string;
    total: number;
    date: string;
    similarity: number;
  }[];
  reason: string;
}

/**
 * Predict when a client will pay an invoice based on their payment history.
 * Uses historical payment patterns to estimate the likely payment date.
 */
export async function predictPaymentDate(
  userId: string,
  clientId: string,
  invoiceTotal: number,
  dueDate: Date
): Promise<PaymentPrediction> {
  // Fetch historical payment data for this client
  const clientInvoices = await prisma.invoice.findMany({
    where: {
      userId,
      clientId,
      status: "paid",
    },
    include: {
      payments: {
        orderBy: { paidAt: "asc" },
        take: 1,
      },
    },
    orderBy: { issueDate: "desc" },
    take: 20,
  });

  // Calculate average days to pay
  const paymentDelays: number[] = [];
  clientInvoices.forEach((inv) => {
    if (inv.payments.length > 0) {
      const issueDate = new Date(inv.issueDate).getTime();
      const paymentDate = new Date(inv.payments[0].paidAt).getTime();
      const days = Math.max(0, (paymentDate - issueDate) / (1000 * 60 * 60 * 24));
      paymentDelays.push(days);
    }
  });

  // Default prediction if no history
  if (paymentDelays.length === 0) {
    const predictedDate = new Date(dueDate);
    predictedDate.setDate(predictedDate.getDate() + 3);

    return {
      predictedDate: predictedDate.toISOString().split("T")[0],
      confidence: 30,
      reasoning:
        "No payment history available for this client. Prediction is based on the due date with a small buffer.",
      avgDaysToPayForClient: 0,
      riskLevel: "medium",
    };
  }

  // Calculate weighted average (recent payments have more weight)
  let weightedSum = 0;
  let totalWeight = 0;
  paymentDelays.forEach((days, index) => {
    const weight = paymentDelays.length - index; // More recent = higher weight
    weightedSum += days * weight;
    totalWeight += weight;
  });

  const avgDays = Math.round(weightedSum / totalWeight);

  // Calculate standard deviation for confidence
  const mean = paymentDelays.reduce((a, b) => a + b, 0) / paymentDelays.length;
  const variance =
    paymentDelays.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) /
    paymentDelays.length;
  const stdDev = Math.sqrt(variance);

  // Higher consistency = higher confidence
  const consistency = Math.max(0, 100 - stdDev * 5);
  const historyBonus = Math.min(20, paymentDelays.length * 4);
  const confidence = Math.min(95, Math.round(consistency * 0.7 + historyBonus));

  // Predicted date from issue date
  const now = new Date();
  const predictedDate = new Date(now);
  predictedDate.setDate(predictedDate.getDate() + avgDays);

  // If predicted date is before due date, use due date as anchor
  if (predictedDate < dueDate) {
    predictedDate.setTime(dueDate.getTime());
  }

  // Risk level based on average payment behavior
  const dueDateMs = dueDate.getTime();
  const predictedMs = predictedDate.getTime();
  const daysAfterDue = (predictedMs - dueDateMs) / (1000 * 60 * 60 * 24);

  let riskLevel: "low" | "medium" | "high" = "low";
  let reasoning = "";

  if (daysAfterDue <= 0) {
    riskLevel = "low";
    reasoning = `This client typically pays within ${avgDays} days, which is before or on the due date. Based on ${paymentDelays.length} historical payments.`;
  } else if (daysAfterDue <= 14) {
    riskLevel = "medium";
    reasoning = `This client typically pays about ${avgDays} days after invoice date, which may be ${Math.round(daysAfterDue)} days after the due date. Monitor and consider a gentle reminder.`;
  } else {
    riskLevel = "high";
    reasoning = `This client averages ${avgDays} days to pay, often significantly past due dates. Consider early reminders and proactive follow-up.`;
  }

  // Factor in invoice amount - larger invoices may take longer
  const avgInvoiceTotal =
    clientInvoices.reduce((sum, inv) => sum + inv.total, 0) / clientInvoices.length;
  if (invoiceTotal > avgInvoiceTotal * 1.5) {
    predictedDate.setDate(predictedDate.getDate() + 3);
    reasoning += ` This invoice is larger than average for this client, which may add a few days.`;
  }

  return {
    predictedDate: predictedDate.toISOString().split("T")[0],
    confidence,
    reasoning,
    avgDaysToPayForClient: Math.round(mean),
    riskLevel,
  };
}

/**
 * Suggest line items for a client based on their invoice history.
 * Returns commonly used items for this client, sorted by frequency.
 */
export async function suggestLineItems(
  userId: string,
  clientId: string,
  description?: string
): Promise<LineItemSuggestion[]> {
  // Fetch all invoice items for this client
  const invoices = await prisma.invoice.findMany({
    where: { userId, clientId },
    include: {
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Aggregate items by description (case-insensitive matching)
  const itemMap: Record<
    string,
    { description: string; rates: number[]; quantities: number[]; count: number }
  > = {};

  invoices.forEach((inv) => {
    inv.items.forEach((item) => {
      const key = item.description.toLowerCase().trim();
      if (!itemMap[key]) {
        itemMap[key] = {
          description: item.description,
          rates: [],
          quantities: [],
          count: 0,
        };
      }
      itemMap[key].rates.push(item.rate);
      itemMap[key].quantities.push(item.quantity);
      itemMap[key].count++;
    });
  });

  let suggestions = Object.values(itemMap)
    .map((item) => {
      // Use the most recent rate and most common quantity
      const latestRate = item.rates[0];
      const avgQuantity =
        item.quantities.reduce((a, b) => a + b, 0) / item.quantities.length;

      return {
        description: item.description,
        quantity: Math.round(avgQuantity * 10) / 10,
        rate: latestRate,
        frequency: item.count,
        confidence: Math.min(95, 50 + item.count * 10),
      };
    })
    .sort((a, b) => b.frequency - a.frequency);

  // If a description filter is provided, do fuzzy matching
  if (description && description.trim()) {
    const search = description.toLowerCase().trim();
    suggestions = suggestions.filter(
      (s) =>
        s.description.toLowerCase().includes(search) ||
        search.split(" ").some((word) =>
          s.description.toLowerCase().includes(word)
        )
    );
  }

  // If no client-specific suggestions, fetch user-wide popular items
  if (suggestions.length === 0) {
    const allInvoices = await prisma.invoice.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const globalMap: Record<
      string,
      { description: string; rates: number[]; count: number }
    > = {};

    allInvoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const key = item.description.toLowerCase().trim();
        if (!globalMap[key]) {
          globalMap[key] = { description: item.description, rates: [], count: 0 };
        }
        globalMap[key].rates.push(item.rate);
        globalMap[key].count++;
      });
    });

    suggestions = Object.values(globalMap)
      .map((item) => ({
        description: item.description,
        quantity: 1,
        rate: item.rates[0],
        frequency: item.count,
        confidence: Math.min(70, 30 + item.count * 5),
      }))
      .sort((a, b) => b.frequency - a.frequency);

    if (description && description.trim()) {
      const search = description.toLowerCase().trim();
      suggestions = suggestions.filter(
        (s) =>
          s.description.toLowerCase().includes(search) ||
          search.split(" ").some((word) =>
            s.description.toLowerCase().includes(word)
          )
      );
    }
  }

  return suggestions.slice(0, 10);
}

/**
 * Check for potential duplicate invoices.
 * Compares against existing invoices for the same client with similar amounts and dates.
 */
export async function detectDuplicateInvoice(
  userId: string,
  clientId: string,
  total: number,
  issueDate: Date,
  items: { description: string; quantity: number; rate: number }[]
): Promise<DuplicateCheck> {
  // Look for invoices to the same client within a reasonable time window
  const windowDays = 30;
  const startDate = new Date(issueDate);
  startDate.setDate(startDate.getDate() - windowDays);
  const endDate = new Date(issueDate);
  endDate.setDate(endDate.getDate() + windowDays);

  const existingInvoices = await prisma.invoice.findMany({
    where: {
      userId,
      clientId,
      issueDate: {
        gte: startDate,
        lte: endDate,
      },
      status: { not: "cancelled" },
    },
    include: {
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingInvoices.length === 0) {
    return {
      isDuplicate: false,
      confidence: 95,
      similarInvoices: [],
      reason: "No similar invoices found for this client in the same time period.",
    };
  }

  const similarInvoices: DuplicateCheck["similarInvoices"] = [];

  for (const inv of existingInvoices) {
    let similarity = 0;

    // Amount similarity (0-40 points)
    const amountDiff = Math.abs(inv.total - total) / Math.max(inv.total, total, 1);
    if (amountDiff === 0) {
      similarity += 40;
    } else if (amountDiff < 0.01) {
      similarity += 35;
    } else if (amountDiff < 0.05) {
      similarity += 20;
    } else if (amountDiff < 0.1) {
      similarity += 10;
    }

    // Date proximity (0-20 points)
    const daysDiff = Math.abs(
      (new Date(inv.issueDate).getTime() - issueDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (daysDiff < 1) {
      similarity += 20;
    } else if (daysDiff < 3) {
      similarity += 15;
    } else if (daysDiff < 7) {
      similarity += 10;
    } else if (daysDiff < 14) {
      similarity += 5;
    }

    // Item similarity (0-40 points)
    if (items.length > 0 && inv.items.length > 0) {
      let matchedItems = 0;
      for (const newItem of items) {
        for (const existingItem of inv.items) {
          const descMatch =
            newItem.description.toLowerCase().trim() ===
            existingItem.description.toLowerCase().trim();
          const rateMatch = Math.abs(newItem.rate - existingItem.rate) < 0.01;
          const qtyMatch = Math.abs(newItem.quantity - existingItem.quantity) < 0.01;

          if (descMatch && rateMatch && qtyMatch) {
            matchedItems++;
            break;
          } else if (descMatch && rateMatch) {
            matchedItems += 0.7;
            break;
          } else if (descMatch) {
            matchedItems += 0.4;
            break;
          }
        }
      }
      const itemSimilarity = matchedItems / Math.max(items.length, inv.items.length);
      similarity += Math.round(itemSimilarity * 40);
    }

    if (similarity >= 30) {
      similarInvoices.push({
        id: inv.id,
        number: inv.number,
        total: inv.total,
        date: new Date(inv.issueDate).toISOString().split("T")[0],
        similarity,
      });
    }
  }

  // Sort by similarity descending
  similarInvoices.sort((a, b) => b.similarity - a.similarity);

  const isDuplicate = similarInvoices.some((s) => s.similarity >= 75);
  const highestSimilarity = similarInvoices[0]?.similarity || 0;

  let reason: string;
  if (isDuplicate) {
    const match = similarInvoices[0];
    reason = `High similarity (${match.similarity}%) with invoice ${match.number} (${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(match.total)}) from ${match.date}. This may be a duplicate.`;
  } else if (similarInvoices.length > 0) {
    reason = `Found ${similarInvoices.length} similar invoice${similarInvoices.length !== 1 ? "s" : ""} but no exact duplicates. Highest similarity: ${highestSimilarity}%.`;
  } else {
    reason = "No similar invoices found for this client in the same time period.";
  }

  return {
    isDuplicate,
    confidence: isDuplicate ? highestSimilarity : 95 - highestSimilarity * 0.5,
    similarInvoices: similarInvoices.slice(0, 5),
    reason,
  };
}
