"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, Send, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import Link from "next/link";

interface LineItem {
  description: string;
  quantity: number;
  rate: number;
}

interface Client {
  id: string;
  name: string;
  company: string | null;
  email: string;
  address: string | null;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function NewInvoicePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [clientId, setClientId] = useState("");
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [taxRate, setTaxRate] = useState(10);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("Payment due within 30 days of invoice date.");
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, rate: 0 },
  ]);

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { status: string }) => {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          issueDate,
          dueDate,
          taxRate,
          notes,
          terms,
          status: data.status,
          items: items.filter((i) => i.description.trim()),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create invoice");
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      toast(
        variables.status === "sent"
          ? "Invoice created and sent!"
          : "Invoice saved as draft!"
      );
      router.push(`/invoices/${data.id}`);
    },
    onError: (error: Error) => {
      toast(error.message, "error");
    },
  });

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, rate: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.rate,
    0
  );
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const selectedClient = clients?.find((c) => c.id === clientId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Create New Invoice
          </h1>
          <p className="text-muted-foreground">
            Fill in the details below to create a new invoice.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Form */}
        <div className="space-y-6">
          {/* Client & Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Client</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.company
                            ? `${client.company} (${client.name})`
                            : client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Issue Date</Label>
                  <Input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Line Items</CardTitle>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_80px_100px_100px_40px] gap-2 text-xs font-medium text-muted-foreground">
                  <span>Description</span>
                  <span>Qty</span>
                  <span>Rate ($)</span>
                  <span>Amount</span>
                  <span></span>
                </div>
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_80px_100px_100px_40px] items-center gap-2"
                  >
                    <Input
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, "description", e.target.value)
                      }
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity || ""}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "quantity",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate || ""}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "rate",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                    <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm">
                      {formatCurrency(item.quantity * item.rate)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={taxRate}
                      onChange={(e) =>
                        setTaxRate(parseFloat(e.target.value) || 0)
                      }
                      className="h-7 w-16 text-xs"
                    />
                    <span className="text-muted-foreground">%</span>
                    <span className="ml-auto">{formatCurrency(tax)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-lg">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes & Terms */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Additional Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Additional notes for the client..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Terms & Conditions</Label>
                <Textarea
                  placeholder="Payment terms and conditions..."
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => createMutation.mutate({ status: "draft" })}
              disabled={createMutation.isPending || !clientId}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Draft
            </Button>
            <Button
              onClick={() => createMutation.mutate({ status: "sent" })}
              disabled={createMutation.isPending || !clientId}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Invoice
            </Button>
          </div>
        </div>

        {/* Live Preview */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Live Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-white p-6 text-xs shadow-sm">
                  {/* Invoice Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-indigo-600">
                        INVOICE
                      </h3>
                      <p className="mt-1 text-gray-500">Draft</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        Alex Design Studio
                      </p>
                      <p className="text-gray-500">123 Creative Blvd</p>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Bill To */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold text-gray-500 uppercase tracking-wider">
                        Bill To
                      </p>
                      {selectedClient ? (
                        <div className="mt-1">
                          <p className="font-medium text-gray-900">
                            {selectedClient.company || selectedClient.name}
                          </p>
                          <p className="text-gray-600">
                            {selectedClient.name}
                          </p>
                          <p className="text-gray-600">
                            {selectedClient.email}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-1 text-gray-400 italic">
                          Select a client
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500">
                        Issue: {issueDate}
                      </p>
                      <p className="text-gray-500">
                        Due: {dueDate}
                      </p>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Items */}
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-gray-500">
                        <th className="py-1 text-left font-medium">Item</th>
                        <th className="py-1 text-right font-medium">Qty</th>
                        <th className="py-1 text-right font-medium">Rate</th>
                        <th className="py-1 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items
                        .filter((i) => i.description.trim())
                        .map((item, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="py-1.5 text-gray-900">
                              {item.description}
                            </td>
                            <td className="py-1.5 text-right text-gray-600">
                              {item.quantity}
                            </td>
                            <td className="py-1.5 text-right text-gray-600">
                              ${item.rate.toFixed(2)}
                            </td>
                            <td className="py-1.5 text-right font-medium text-gray-900">
                              ${(item.quantity * item.rate).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      {items.filter((i) => i.description.trim()).length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-4 text-center text-gray-400 italic"
                          >
                            Add items to see preview
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className="mt-4 flex justify-end">
                    <div className="w-40 space-y-1">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Tax ({taxRate}%)</span>
                        <span>${tax.toFixed(2)}</span>
                      </div>
                      <Separator className="my-1" />
                      <div className="flex justify-between font-bold text-gray-900 text-sm">
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {notes && (
                    <div className="mt-4 rounded bg-gray-50 p-2">
                      <p className="font-medium text-gray-500">Notes</p>
                      <p className="text-gray-600">{notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
