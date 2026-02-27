"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Edit,
  Send,
  CreditCard,
  Printer,
  Trash2,
  Loader2,
  Bell,
  Copy,
  XCircle,
  Mail,
  Link2,
  Brain,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/toaster";

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

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-700 border-blue-200" },
  viewed: { label: "Viewed", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-700 border-red-200" },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

const paymentMethodLabels: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  credit_card: "Credit Card",
  paypal: "PayPal",
  check: "Check",
  cash: "Cash",
  other: "Other",
};

const gatewayLabels: Record<string, string> = {
  manual: "Manual",
  stripe: "Stripe",
  razorpay: "Razorpay",
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentReference, setPaymentReference] = useState("");

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${id}`);
      if (!res.ok) throw new Error("Failed to fetch invoice");
      return res.json();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${id}/send`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to send");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast("Invoice sent successfully! Email notification sent to client.");
    },
    onError: () => toast("Failed to send invoice", "error"),
  });

  const remindMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${id}/remind`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to send reminder");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast(data.message || "Payment reminder sent!");
    },
    onError: () => toast("Failed to send reminder", "error"),
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to duplicate");
      return res.json();
    },
    onSuccess: (data) => {
      toast("Invoice duplicated as draft!");
      router.push(`/invoices/${data.id}`);
    },
    onError: () => toast("Failed to duplicate invoice", "error"),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error("Failed to cancel");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast("Invoice cancelled.");
    },
    onError: () => toast("Failed to cancel invoice", "error"),
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          method: paymentMethod,
          reference: paymentReference || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record payment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      setPaymentOpen(false);
      setPaymentAmount("");
      setPaymentReference("");
      toast("Payment recorded successfully!");
    },
    onError: (error: Error) => toast(error.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      toast("Invoice deleted successfully!");
      router.push("/invoices");
    },
    onError: () => toast("Failed to delete invoice", "error"),
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (type: string) => {
      const res = await fetch(`/api/invoices/${id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send email");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast(data.message || "Email sent successfully!");
    },
    onError: (error: Error) => toast(error.message, "error"),
  });

  const [prediction, setPrediction] = useState<{
    predictedDate: string;
    confidence: number;
    reasoning: string;
    riskLevel: string;
  } | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);

  const handlePredictPayment = async () => {
    if (!invoice) return;
    setPredictionLoading(true);
    try {
      const res = await fetch("/api/invoices/smart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "predict-payment",
          clientId: invoice.clientId,
          invoiceTotal: invoice.total,
          dueDate: invoice.dueDate,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPrediction(data);
      }
    } catch {
      toast("Failed to generate prediction", "error");
    } finally {
      setPredictionLoading(false);
    }
  };

  const copyPaymentLink = () => {
    const link = `${window.location.origin}/pay/${id}`;
    navigator.clipboard.writeText(link);
    toast("Payment link copied to clipboard!");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center py-16">
        <h2 className="text-lg font-semibold">Invoice not found</h2>
        <Button asChild className="mt-4">
          <Link href="/invoices">Back to Invoices</Link>
        </Button>
      </div>
    );
  }

  const totalPaid = invoice.payments?.reduce(
    (sum: number, p: { amount: number }) => sum + p.amount,
    0
  ) || 0;
  const balanceDue = invoice.total - totalPaid;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/invoices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{invoice.number}</h1>
              <Badge
                variant="outline"
                className={statusConfig[invoice.status]?.className || ""}
              >
                {statusConfig[invoice.status]?.label || invoice.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {invoice.client.company || invoice.client.name}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/invoices/${id}/edit`}>
              <Edit className="h-4 w-4" />
              Edit
            </Link>
          </Button>
          {(invoice.status === "draft" || invoice.status === "sent") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
            >
              <Send className="h-4 w-4" />
              {invoice.status === "draft" ? "Send" : "Resend"}
            </Button>
          )}
          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => remindMutation.mutate()}
              disabled={remindMutation.isPending}
            >
              <Bell className="h-4 w-4" />
              Remind
            </Button>
          )}
          {(invoice.status === "draft" || invoice.status === "sent") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendEmailMutation.mutate("invoice")}
              disabled={sendEmailMutation.isPending}
            >
              <Mail className="h-4 w-4" />
              Email
            </Button>
          )}
          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendEmailMutation.mutate("reminder")}
              disabled={sendEmailMutation.isPending}
            >
              <Mail className="h-4 w-4" />
              Email Reminder
            </Button>
          )}
          {invoice.status !== "cancelled" && (
            <Button
              variant="outline"
              size="sm"
              onClick={copyPaymentLink}
            >
              <Link2 className="h-4 w-4" />
              Payment Link
            </Button>
          )}
          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <CreditCard className="h-4 w-4" />
                  Record Payment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Payment</DialogTitle>
                  <DialogDescription>
                    Record a payment for invoice {invoice.number}. Balance due:{" "}
                    {formatCurrency(balanceDue)}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Amount ($)</Label>
                    <Input
                      type="number"
                      min="0.01"
                      max={balanceDue}
                      step="0.01"
                      placeholder={balanceDue.toFixed(2)}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reference (Optional)</Label>
                    <Input
                      placeholder="Transaction ID, check number, etc."
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setPaymentOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => paymentMutation.mutate()}
                    disabled={
                      paymentMutation.isPending ||
                      !paymentAmount ||
                      parseFloat(paymentAmount) <= 0
                    }
                  >
                    {paymentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    Record Payment
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => duplicateMutation.mutate()}
            disabled={duplicateMutation.isPending}
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </Button>
          {invoice.status !== "cancelled" && invoice.status !== "paid" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("Are you sure you want to cancel this invoice?")) {
                  cancelMutation.mutate();
                }
              }}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Are you sure you want to delete this invoice?")) {
                deleteMutation.mutate();
              }
            }}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Invoice Document */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="p-8">
          {/* Invoice Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold text-primary">INVOICE</h2>
              <p className="mt-1 text-lg font-semibold text-muted-foreground">
                {invoice.number}
              </p>
            </div>
            <div className="text-right">
              <h3 className="text-lg font-bold">
                {invoice.user?.businessName || invoice.user?.name}
              </h3>
              {invoice.user?.address && (
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
                  {invoice.user.address}
                </p>
              )}
              {invoice.user?.phone && (
                <p className="text-sm text-muted-foreground">
                  {invoice.user.phone}
                </p>
              )}
              {invoice.user?.email && (
                <p className="text-sm text-muted-foreground">
                  {invoice.user.email}
                </p>
              )}
              {invoice.user?.taxId && (
                <p className="text-sm text-muted-foreground">
                  Tax ID: {invoice.user.taxId}
                </p>
              )}
            </div>
          </div>

          <Separator className="my-6" />

          {/* Bill To / Invoice Info */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Bill To
              </p>
              <div className="mt-2">
                {invoice.client.company && (
                  <p className="font-semibold">{invoice.client.company}</p>
                )}
                <p className={invoice.client.company ? "" : "font-semibold"}>
                  {invoice.client.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {invoice.client.email}
                </p>
                {invoice.client.phone && (
                  <p className="text-sm text-muted-foreground">
                    {invoice.client.phone}
                  </p>
                )}
                {invoice.client.address && (
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {invoice.client.address}
                  </p>
                )}
              </div>
            </div>
            <div className="sm:text-right">
              <div className="space-y-1">
                <div className="flex justify-between sm:justify-end sm:gap-6">
                  <span className="text-sm text-muted-foreground">
                    Issue Date:
                  </span>
                  <span className="text-sm font-medium">
                    {formatDate(invoice.issueDate)}
                  </span>
                </div>
                <div className="flex justify-between sm:justify-end sm:gap-6">
                  <span className="text-sm text-muted-foreground">
                    Due Date:
                  </span>
                  <span className="text-sm font-medium">
                    {formatDate(invoice.dueDate)}
                  </span>
                </div>
                <div className="flex justify-between sm:justify-end sm:gap-6">
                  <span className="text-sm text-muted-foreground">
                    Status:
                  </span>
                  <Badge
                    variant="outline"
                    className={statusConfig[invoice.status]?.className || ""}
                  >
                    {statusConfig[invoice.status]?.label || invoice.status}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mt-8">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items?.map(
                  (item: {
                    id: string;
                    description: string;
                    quantity: number;
                    rate: number;
                    amount: number;
                  }) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.description}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.rate)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.amount)}
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Tax ({invoice.taxRate}%)
                </span>
                <span>{formatCurrency(invoice.tax)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
              {totalPaid > 0 && (
                <>
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Paid</span>
                    <span>-{formatCurrency(totalPaid)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Balance Due</span>
                    <span
                      className={
                        balanceDue > 0 ? "text-destructive" : "text-emerald-600"
                      }
                    >
                      {formatCurrency(balanceDue)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <div className="mt-8 space-y-4">
              <Separator />
              {invoice.notes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Notes
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {invoice.notes}
                  </p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Terms & Conditions
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {invoice.terms}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      {invoice.payments && invoice.payments.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Payment Timeline</CardTitle>
            {invoice.status === "paid" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendEmailMutation.mutate("confirmation")}
                disabled={sendEmailMutation.isPending}
              >
                <Mail className="h-4 w-4" />
                Send Receipt
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {invoice.payments.map(
                (payment: {
                  id: string;
                  amount: number;
                  method: string;
                  gateway: string;
                  reference: string | null;
                  status: string;
                  paidAt: string;
                }) => (
                  <div key={payment.id} className="flex items-start gap-4">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-emerald-600">
                          {formatCurrency(payment.amount)}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(payment.paidAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                        <span>
                          {paymentMethodLabels[payment.method] || payment.method}
                        </span>
                        {payment.gateway !== "manual" && (
                          <>
                            <span className="text-xs">via</span>
                            <Badge variant="outline" className="text-xs">
                              {gatewayLabels[payment.gateway] || payment.gateway}
                            </Badge>
                          </>
                        )}
                        {payment.reference && (
                          <span className="text-xs">Ref: {payment.reference}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Payment Prediction */}
      {invoice.status !== "paid" && invoice.status !== "cancelled" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Smart Insights
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePredictPayment}
              disabled={predictionLoading}
            >
              {predictionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              Predict Payment
            </Button>
          </CardHeader>
          {prediction && (
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Predicted Payment Date
                  </span>
                  <span className="font-semibold">
                    {formatDate(prediction.predictedDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Confidence
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          prediction.confidence >= 70
                            ? "bg-emerald-500"
                            : prediction.confidence >= 40
                            ? "bg-amber-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${prediction.confidence}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {prediction.confidence}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Risk Level
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      prediction.riskLevel === "low"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : prediction.riskLevel === "medium"
                        ? "bg-amber-100 text-amber-700 border-amber-200"
                        : "bg-red-100 text-red-700 border-red-200"
                    }
                  >
                    {prediction.riskLevel.charAt(0).toUpperCase() +
                      prediction.riskLevel.slice(1)}{" "}
                    Risk
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2 p-3 rounded-lg bg-muted/50">
                  {prediction.reasoning}
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
