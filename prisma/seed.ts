import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clean up existing data
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  // Create demo user
  const hashedPassword = await bcrypt.hash("password123", 10);
  const user = await prisma.user.create({
    data: {
      email: "demo@invoflow.com",
      name: "Alex Morgan",
      password: hashedPassword,
      businessName: "Alex Design Studio",
      address: "123 Creative Blvd, Suite 400\nSan Francisco, CA 94102",
      phone: "+1 (555) 123-4567",
      taxId: "US-TAX-12345678",
      currency: "USD",
      plan: "pro",
      invoiceCounter: 15,
    },
  });

  // Create 5 clients
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        name: "Sarah Johnson",
        email: "sarah@techvision.io",
        phone: "+1 (555) 234-5678",
        company: "TechVision Inc.",
        address: "456 Innovation Way\nPalo Alto, CA 94301",
        notes: "Preferred client. Net 30 terms.",
        userId: user.id,
      },
    }),
    prisma.client.create({
      data: {
        name: "Marcus Chen",
        email: "marcus@greenleaf.co",
        phone: "+1 (555) 345-6789",
        company: "GreenLeaf Solutions",
        address: "789 Sustainability Dr\nPortland, OR 97201",
        notes: "Ongoing branding project.",
        userId: user.id,
      },
    }),
    prisma.client.create({
      data: {
        name: "Emily Rodriguez",
        email: "emily@brightpath.com",
        phone: "+1 (555) 456-7890",
        company: "BrightPath Education",
        address: "321 Learning Lane\nAustin, TX 78701",
        userId: user.id,
      },
    }),
    prisma.client.create({
      data: {
        name: "David Kim",
        email: "david@urbancraft.co",
        phone: "+1 (555) 567-8901",
        company: "UrbanCraft Studios",
        address: "555 Design District\nNew York, NY 10001",
        notes: "High-priority client. Fast turnaround expected.",
        userId: user.id,
      },
    }),
    prisma.client.create({
      data: {
        name: "Rachel Thompson",
        email: "rachel@cloudnine.io",
        phone: "+1 (555) 678-9012",
        company: "CloudNine Software",
        address: "888 Cloud Ave\nSeattle, WA 98101",
        userId: user.id,
      },
    }),
  ]);

  const now = new Date();
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 10);
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 5);
  const fourMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 4, 20);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  // Create 15 invoices with items
  // 5 PAID invoices
  const inv1 = await prisma.invoice.create({
    data: {
      number: "INV-001",
      status: "paid",
      issueDate: fourMonthsAgo,
      dueDate: new Date(fourMonthsAgo.getTime() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 4500,
      taxRate: 10,
      tax: 450,
      total: 4950,
      notes: "Thank you for your business!",
      terms: "Payment due within 30 days.",
      currency: "USD",
      clientId: clients[0].id,
      userId: user.id,
      items: {
        create: [
          { description: "Website redesign - homepage", quantity: 1, rate: 2500, amount: 2500 },
          { description: "Website redesign - inner pages (5)", quantity: 5, rate: 400, amount: 2000 },
        ],
      },
    },
  });

  const inv2 = await prisma.invoice.create({
    data: {
      number: "INV-002",
      status: "paid",
      issueDate: threeMonthsAgo,
      dueDate: new Date(threeMonthsAgo.getTime() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 3200,
      taxRate: 10,
      tax: 320,
      total: 3520,
      currency: "USD",
      clientId: clients[1].id,
      userId: user.id,
      items: {
        create: [
          { description: "Brand identity package", quantity: 1, rate: 2000, amount: 2000 },
          { description: "Logo variations (3 concepts)", quantity: 3, rate: 400, amount: 1200 },
        ],
      },
    },
  });

  const inv3 = await prisma.invoice.create({
    data: {
      number: "INV-003",
      status: "paid",
      issueDate: twoMonthsAgo,
      dueDate: new Date(twoMonthsAgo.getTime() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 1800,
      taxRate: 10,
      tax: 180,
      total: 1980,
      currency: "USD",
      clientId: clients[2].id,
      userId: user.id,
      items: {
        create: [
          { description: "Course landing page design", quantity: 1, rate: 1200, amount: 1200 },
          { description: "Email template design", quantity: 2, rate: 300, amount: 600 },
        ],
      },
    },
  });

  const inv4 = await prisma.invoice.create({
    data: {
      number: "INV-004",
      status: "paid",
      issueDate: monthAgo,
      dueDate: new Date(monthAgo.getTime() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 6000,
      taxRate: 10,
      tax: 600,
      total: 6600,
      notes: "Phase 1 complete. Phase 2 to follow.",
      currency: "USD",
      clientId: clients[3].id,
      userId: user.id,
      items: {
        create: [
          { description: "UI/UX design - mobile app", quantity: 1, rate: 4000, amount: 4000 },
          { description: "Wireframes & prototyping", quantity: 1, rate: 1500, amount: 1500 },
          { description: "Design system documentation", quantity: 1, rate: 500, amount: 500 },
        ],
      },
    },
  });

  const inv5 = await prisma.invoice.create({
    data: {
      number: "INV-005",
      status: "paid",
      issueDate: twoWeeksAgo,
      dueDate: new Date(twoWeeksAgo.getTime() + 15 * 24 * 60 * 60 * 1000),
      subtotal: 2400,
      taxRate: 10,
      tax: 240,
      total: 2640,
      currency: "USD",
      clientId: clients[4].id,
      userId: user.id,
      items: {
        create: [
          { description: "SaaS dashboard UI design", quantity: 1, rate: 1800, amount: 1800 },
          { description: "Icon set (24 icons)", quantity: 24, rate: 25, amount: 600 },
        ],
      },
    },
  });

  // 4 SENT invoices
  const inv6 = await prisma.invoice.create({
    data: {
      number: "INV-006",
      status: "sent",
      issueDate: lastWeek,
      dueDate: nextMonth,
      subtotal: 3500,
      taxRate: 10,
      tax: 350,
      total: 3850,
      notes: "Please remit payment to the address above.",
      terms: "Net 30. Late payments subject to 1.5% monthly interest.",
      currency: "USD",
      clientId: clients[0].id,
      userId: user.id,
      items: {
        create: [
          { description: "E-commerce website development", quantity: 1, rate: 2500, amount: 2500 },
          { description: "Product photography editing", quantity: 20, rate: 50, amount: 1000 },
        ],
      },
    },
  });

  const inv7 = await prisma.invoice.create({
    data: {
      number: "INV-007",
      status: "sent",
      issueDate: fiveDaysAgo,
      dueDate: nextMonth,
      subtotal: 2200,
      taxRate: 10,
      tax: 220,
      total: 2420,
      currency: "USD",
      clientId: clients[1].id,
      userId: user.id,
      items: {
        create: [
          { description: "Marketing collateral design", quantity: 1, rate: 1200, amount: 1200 },
          { description: "Social media templates (10)", quantity: 10, rate: 100, amount: 1000 },
        ],
      },
    },
  });

  const inv8 = await prisma.invoice.create({
    data: {
      number: "INV-008",
      status: "sent",
      issueDate: yesterday,
      dueDate: nextMonth,
      subtotal: 5500,
      taxRate: 10,
      tax: 550,
      total: 6050,
      currency: "USD",
      clientId: clients[3].id,
      userId: user.id,
      items: {
        create: [
          { description: "Mobile app UI - Phase 2", quantity: 1, rate: 3500, amount: 3500 },
          { description: "Animation & micro-interactions", quantity: 1, rate: 1200, amount: 1200 },
          { description: "User testing facilitation", quantity: 4, rate: 200, amount: 800 },
        ],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      number: "INV-009",
      status: "sent",
      issueDate: now,
      dueDate: nextMonth,
      subtotal: 1500,
      taxRate: 10,
      tax: 150,
      total: 1650,
      currency: "USD",
      clientId: clients[4].id,
      userId: user.id,
      items: {
        create: [
          { description: "Dashboard improvements", quantity: 1, rate: 1000, amount: 1000 },
          { description: "Performance optimization report", quantity: 1, rate: 500, amount: 500 },
        ],
      },
    },
  });

  // 2 OVERDUE invoices
  await prisma.invoice.create({
    data: {
      number: "INV-010",
      status: "overdue",
      issueDate: twoMonthsAgo,
      dueDate: monthAgo,
      subtotal: 4200,
      taxRate: 10,
      tax: 420,
      total: 4620,
      notes: "OVERDUE - Please remit payment immediately.",
      currency: "USD",
      reminderCount: 2,
      lastRemindedAt: lastWeek,
      clientId: clients[2].id,
      userId: user.id,
      items: {
        create: [
          { description: "Online course platform design", quantity: 1, rate: 3000, amount: 3000 },
          { description: "Student portal wireframes", quantity: 1, rate: 1200, amount: 1200 },
        ],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      number: "INV-011",
      status: "overdue",
      issueDate: monthAgo,
      dueDate: lastWeek,
      subtotal: 1600,
      taxRate: 10,
      tax: 160,
      total: 1760,
      currency: "USD",
      reminderCount: 1,
      lastRemindedAt: fiveDaysAgo,
      clientId: clients[4].id,
      userId: user.id,
      items: {
        create: [
          { description: "Data visualization components", quantity: 8, rate: 200, amount: 1600 },
        ],
      },
    },
  });

  // 3 DRAFT invoices
  await prisma.invoice.create({
    data: {
      number: "INV-012",
      status: "draft",
      issueDate: now,
      dueDate: nextMonth,
      subtotal: 3800,
      taxRate: 10,
      tax: 380,
      total: 4180,
      currency: "USD",
      clientId: clients[0].id,
      userId: user.id,
      items: {
        create: [
          { description: "Website maintenance (monthly)", quantity: 1, rate: 800, amount: 800 },
          { description: "SEO audit & optimization", quantity: 1, rate: 1500, amount: 1500 },
          { description: "Content strategy consultation", quantity: 3, rate: 500, amount: 1500 },
        ],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      number: "INV-013",
      status: "draft",
      issueDate: now,
      dueDate: nextMonth,
      subtotal: 2600,
      taxRate: 10,
      tax: 260,
      total: 2860,
      currency: "USD",
      clientId: clients[1].id,
      userId: user.id,
      items: {
        create: [
          { description: "Brand guidelines update", quantity: 1, rate: 1600, amount: 1600 },
          { description: "Presentation template", quantity: 2, rate: 500, amount: 1000 },
        ],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      number: "INV-014",
      status: "draft",
      issueDate: now,
      dueDate: nextWeek,
      subtotal: 900,
      taxRate: 10,
      tax: 90,
      total: 990,
      currency: "USD",
      clientId: clients[3].id,
      userId: user.id,
      items: {
        create: [
          { description: "App store screenshots design", quantity: 6, rate: 150, amount: 900 },
        ],
      },
    },
  });

  // 1 CANCELLED invoice
  await prisma.invoice.create({
    data: {
      number: "INV-015",
      status: "cancelled",
      issueDate: monthAgo,
      dueDate: new Date(monthAgo.getTime() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 2000,
      taxRate: 10,
      tax: 200,
      total: 2200,
      notes: "Project cancelled by client.",
      currency: "USD",
      clientId: clients[2].id,
      userId: user.id,
      items: {
        create: [
          { description: "Workshop materials design", quantity: 1, rate: 1200, amount: 1200 },
          { description: "Printed handouts layout", quantity: 4, rate: 200, amount: 800 },
        ],
      },
    },
  });

  // Create 8 payments for paid invoices
  await prisma.payment.create({
    data: {
      amount: 4950,
      method: "bank_transfer",
      gateway: "manual",
      status: "completed",
      reference: "TRF-20240815-001",
      paidAt: new Date(fourMonthsAgo.getTime() + 20 * 24 * 60 * 60 * 1000),
      invoiceId: inv1.id,
    },
  });

  await prisma.payment.create({
    data: {
      amount: 3520,
      method: "credit_card",
      gateway: "stripe",
      gatewayPaymentId: "pi_mock_stripe_001",
      status: "completed",
      reference: "CC-20240910-002",
      paidAt: new Date(threeMonthsAgo.getTime() + 15 * 24 * 60 * 60 * 1000),
      invoiceId: inv2.id,
    },
  });

  await prisma.payment.create({
    data: {
      amount: 1980,
      method: "paypal",
      gateway: "manual",
      status: "completed",
      reference: "PP-20241012-003",
      paidAt: new Date(twoMonthsAgo.getTime() + 18 * 24 * 60 * 60 * 1000),
      invoiceId: inv3.id,
    },
  });

  await prisma.payment.create({
    data: {
      amount: 3300,
      method: "bank_transfer",
      gateway: "manual",
      status: "completed",
      reference: "TRF-20241120-004A",
      paidAt: new Date(monthAgo.getTime() + 10 * 24 * 60 * 60 * 1000),
      invoiceId: inv4.id,
    },
  });

  await prisma.payment.create({
    data: {
      amount: 3300,
      method: "bank_transfer",
      gateway: "razorpay",
      gatewayPaymentId: "pay_mock_razorpay_001",
      status: "completed",
      reference: "TRF-20241125-004B",
      paidAt: new Date(monthAgo.getTime() + 15 * 24 * 60 * 60 * 1000),
      invoiceId: inv4.id,
    },
  });

  await prisma.payment.create({
    data: {
      amount: 2640,
      method: "credit_card",
      gateway: "stripe",
      gatewayPaymentId: "pi_mock_stripe_002",
      status: "completed",
      reference: "CC-20241205-005",
      paidAt: new Date(twoWeeksAgo.getTime() + 5 * 24 * 60 * 60 * 1000),
      invoiceId: inv5.id,
    },
  });

  // Partial payments on sent invoices
  await prisma.payment.create({
    data: {
      amount: 1925,
      method: "paypal",
      gateway: "manual",
      status: "completed",
      reference: "PP-20241210-006",
      paidAt: fiveDaysAgo,
      invoiceId: inv6.id,
    },
  });

  await prisma.payment.create({
    data: {
      amount: 1000,
      method: "check",
      gateway: "manual",
      status: "completed",
      reference: "CHK-4521",
      paidAt: yesterday,
      invoiceId: inv7.id,
    },
  });

  console.log("Seed data created successfully!");
  console.log(`  - 1 user: demo@invoflow.com / password123`);
  console.log(`  - 5 clients`);
  console.log(`  - 15 invoices (3 draft, 4 sent, 5 paid, 2 overdue, 1 cancelled)`);
  console.log(`  - 30+ invoice items`);
  console.log(`  - 8 payments`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
