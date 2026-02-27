"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditCard } from "lucide-react";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const methodLabels: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  credit_card: "Credit Card",
  paypal: "PayPal",
  check: "Check",
  cash: "Cash",
  other: "Other",
};

const methodColors: Record<string, string> = {
  bank_transfer: "#6366f1",
  credit_card: "#8b5cf6",
  paypal: "#3b82f6",
  check: "#10b981",
  cash: "#f59e0b",
  other: "#6b7280",
};

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
  invoice: {
    number: string;
    client: {
      name: string;
      company: string | null;
    };
  };
}

export default function PaymentsPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: payments, isLoading } = useQuery<PaymentRecord[]>({
    queryKey: ["payments", fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/payments?${params}`);
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });

  // Calculate method distribution for pie chart
  const methodTotals: Record<string, number> = {};
  payments?.forEach((p) => {
    methodTotals[p.method] = (methodTotals[p.method] || 0) + p.amount;
  });

  const pieData = Object.entries(methodTotals).map(([method, amount]) => ({
    name: methodLabels[method] || method,
    value: amount,
    color: methodColors[method] || "#6b7280",
  }));

  const totalReceived = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">
          Track all payments received across your invoices.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label className="text-xs">From Date</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">To Date</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-auto"
          />
        </div>
        {(fromDate || toDate) && (
          <button
            onClick={() => {
              setFromDate("");
              setToDate("");
            }}
            className="text-sm text-primary hover:underline pb-2"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        {/* Payments Table */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : payments && payments.length > 0 ? (
          <div>
            <Card className="mb-4">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                    <CreditCard className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Received
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(totalReceived)}
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-auto">
                    {payments.length} payment{payments.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDate(payment.paidAt)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/invoices`}
                          className="font-medium text-primary hover:underline"
                        >
                          {payment.invoice.number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {payment.invoice.client.company ||
                          payment.invoice.client.name}
                      </TableCell>
                      <TableCell className="font-semibold text-emerald-600">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {methodLabels[payment.method] || payment.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.reference || "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
            <CreditCard className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No payments found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Payments will appear here once clients pay their invoices.
            </p>
          </div>
        )}

        {/* Pie Chart */}
        {pieData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Payment Methods
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        backgroundColor: "hsl(var(--card))",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
