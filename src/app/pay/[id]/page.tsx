"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreditCard,
  CheckCircle2,
  Receipt,
  Loader2,
  ShieldCheck,
  Calendar,
  Building2,
} from "lucide-react";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface PaymentPageData {
  id: string;
  number: string;
  status: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  currency: string;
  notes: string | null;
  terms: string | null;
  totalPaid: number;
  balanceDue: number;
  items: {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
  client: { name: string; company: string | null; email: string };
  business: { name: string; email: string };
}

export default function PublicPaymentPage() {
  const params = useParams();
  const id = params.id as string;

  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("credit_card");
  const [paid, setPaid] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{
    gatewayPaymentId: string;
    amount: number;
  } | null>(null);

  const { data: invoice, isLoading, error } = useQuery<PaymentPageData>({
    queryKey: ["pay-invoice", id],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${id}/pay`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load invoice");
      }
      return res.json();
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: paymentMethod,
          payerName: payerName || undefined,
          payerEmail: payerEmail || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Payment failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setPaid(true);
      setPaymentResult(data.payment);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
        <div className="mx-auto max-w-2xl space-y-6">
          <Skeleton className="h-12 w-64 mx-auto" />
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <Receipt className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold">Invoice Not Available</h2>
            <p className="mt-2 text-muted-foreground">
              {(error as Error)?.message || "This invoice could not be found or is no longer available."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Payment success view
  if (paid && paymentResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-800">
              Payment Successful!
            </h2>
            <p className="mt-2 text-muted-foreground">
              Your payment of {formatCurrency(paymentResult.amount)} for invoice{" "}
              {invoice.number} has been processed.
            </p>
            <div className="mt-6 rounded-lg bg-muted/50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Confirmation ID</span>
                <span className="font-mono font-medium">
                  {paymentResult.gatewayPaymentId}
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-semibold text-emerald-600">
                  {formatCurrency(paymentResult.amount)}
                </span>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              A payment confirmation has been sent to your email.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already paid
  if (invoice.status === "paid" || invoice.balanceDue <= 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-emerald-800">
              Invoice Already Paid
            </h2>
            <p className="mt-2 text-muted-foreground">
              Invoice {invoice.number} has already been fully paid. No further
              action is needed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm border">
            <Receipt className="h-5 w-5 text-primary" />
            <span className="font-semibold">InvoFlow</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold">
            Invoice from {invoice.business.name}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Invoice {invoice.number}
          </p>
        </div>

        {/* Invoice Summary */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Invoice Summary</CardTitle>
              <Badge
                variant="outline"
                className={
                  invoice.status === "overdue"
                    ? "bg-red-100 text-red-700 border-red-200"
                    : "bg-blue-100 text-blue-700 border-blue-200"
                }
              >
                {invoice.status === "overdue" ? "Overdue" : "Due"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client and dates */}
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Bill To</p>
                  <p className="font-medium">
                    {invoice.client.company || invoice.client.name}
                  </p>
                  <p className="text-muted-foreground">{invoice.client.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-medium">{formatDate(invoice.dueDate)}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Line Items */}
            <div className="space-y-2">
              {invoice.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex-1">
                    <span className="font-medium">{item.description}</span>
                    <span className="ml-2 text-muted-foreground">
                      x{item.quantity} @ {formatCurrency(item.rate)}
                    </span>
                  </div>
                  <span className="ml-4 font-medium">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Tax ({invoice.taxRate}%)
                  </span>
                  <span>{formatCurrency(invoice.tax)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2">
                <span>Total</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
              {invoice.totalPaid > 0 && (
                <>
                  <div className="flex justify-between text-emerald-600">
                    <span>Paid</span>
                    <span>-{formatCurrency(invoice.totalPaid)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg pt-1">
                    <span>Balance Due</span>
                    <span className="text-primary">
                      {formatCurrency(invoice.balanceDue)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Pay {formatCurrency(invoice.balanceDue)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payerName">Your Name</Label>
                <Input
                  id="payerName"
                  placeholder="John Doe"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payerEmail">Your Email</Label>
                <Input
                  id="payerEmail"
                  type="email"
                  placeholder="john@example.com"
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "credit_card", label: "Card" },
                  { value: "bank_transfer", label: "Bank" },
                  { value: "paypal", label: "PayPal" },
                ].map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPaymentMethod(m.value)}
                    className={`rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors ${
                      paymentMethod === m.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {payMutation.isError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {(payMutation.error as Error)?.message || "Payment failed. Please try again."}
              </div>
            )}

            <Button
              className="w-full h-12 text-base"
              onClick={() => payMutation.mutate()}
              disabled={payMutation.isPending}
            >
              {payMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5" />
                  Pay {formatCurrency(invoice.balanceDue)}
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              <ShieldCheck className="inline h-3 w-3 mr-1" />
              Secure payment powered by InvoFlow. Your payment information is
              encrypted and secure.
            </p>
          </CardContent>
        </Card>

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Notes</p>
            {invoice.notes}
          </div>
        )}
      </div>
    </div>
  );
}
