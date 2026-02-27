"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
  Plus,
  Repeat,
  Trash2,
  Pause,
  Play,
  Loader2,
} from "lucide-react";
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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

interface Client {
  id: string;
  name: string;
  company: string | null;
  email: string;
}

interface TemplateItem {
  description: string;
  quantity: number;
  rate: number;
}

interface RecurringInvoice {
  id: string;
  clientId: string;
  client: Client | null;
  frequency: string;
  nextDate: string;
  active: boolean;
  templateData: {
    items: TemplateItem[];
    notes: string | null;
    terms: string | null;
    taxRate: number;
    currency: string;
  };
  createdAt: string;
}

export default function RecurringPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [nextDate, setNextDate] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TemplateItem[]>([
    { description: "", quantity: 1, rate: 0 },
  ]);

  const { data: recurring, isLoading } = useQuery<RecurringInvoice[]>({
    queryKey: ["recurring-invoices"],
    queryFn: async () => {
      const res = await fetch("/api/invoices/recurring");
      if (!res.ok) throw new Error("Failed to fetch recurring invoices");
      return res.json();
    },
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/invoices/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient,
          frequency,
          nextDate,
          taxRate: parseFloat(taxRate) || 0,
          items: items.filter((i) => i.description.trim()),
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-invoices"] });
      setCreateOpen(false);
      resetForm();
      toast("Recurring invoice template created!");
    },
    onError: (error: Error) => toast(error.message, "error"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch("/api/invoices/recurring", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["recurring-invoices"] });
      toast(variables.active ? "Recurring invoice activated" : "Recurring invoice paused");
    },
    onError: () => toast("Failed to update", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invoices/recurring?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-invoices"] });
      toast("Recurring invoice deleted");
    },
    onError: () => toast("Failed to delete", "error"),
  });

  function resetForm() {
    setSelectedClient("");
    setFrequency("monthly");
    setNextDate("");
    setTaxRate("0");
    setNotes("");
    setItems([{ description: "", quantity: 1, rate: 0 }]);
  }

  function addItem() {
    setItems([...items, { description: "", quantity: 1, rate: 0 }]);
  }

  function removeItem(index: number) {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  }

  function updateItem(index: number, field: keyof TemplateItem, value: string | number) {
    const newItems = [...items];
    if (field === "description") {
      newItems[index].description = value as string;
    } else {
      newItems[index][field] = parseFloat(value as string) || 0;
    }
    setItems(newItems);
  }

  const templateTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.rate,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Recurring Invoices
          </h1>
          <p className="text-muted-foreground">
            Set up automatic invoice templates that generate on a schedule.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              New Recurring Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Recurring Invoice</DialogTitle>
              <DialogDescription>
                Set up an invoice template that will generate automatically on
                your chosen schedule.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select
                    value={selectedClient}
                    onValueChange={setSelectedClient}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.company || client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Next Invoice Date</Label>
                  <Input
                    type="date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tax Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <Label>Line Items</Label>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        {index === 0 && (
                          <Label className="text-xs text-muted-foreground">
                            Description
                          </Label>
                        )}
                        <Input
                          placeholder="Service description"
                          value={item.description}
                          onChange={(e) =>
                            updateItem(index, "description", e.target.value)
                          }
                        />
                      </div>
                      <div className="w-20">
                        {index === 0 && (
                          <Label className="text-xs text-muted-foreground">
                            Qty
                          </Label>
                        )}
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, "quantity", e.target.value)
                          }
                        />
                      </div>
                      <div className="w-28">
                        {index === 0 && (
                          <Label className="text-xs text-muted-foreground">
                            Rate ($)
                          </Label>
                        )}
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) =>
                            updateItem(index, "rate", e.target.value)
                          }
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </div>

              {templateTotal > 0 && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex justify-between font-medium">
                    <span>Estimated Total</span>
                    <span>{formatCurrency(templateTotal)}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input
                  placeholder="Notes to include on each invoice"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={
                  createMutation.isPending ||
                  !selectedClient ||
                  !nextDate ||
                  items.every((i) => !i.description.trim())
                }
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Repeat className="h-4 w-4" />
                )}
                Create Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Recurring Invoices List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : recurring && recurring.length > 0 ? (
        <div className="space-y-4">
          {recurring.map((rec) => {
            const total = rec.templateData?.items?.reduce(
              (sum: number, item: TemplateItem) =>
                sum + item.quantity * item.rate,
              0
            ) || 0;

            return (
              <Card key={rec.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          rec.active
                            ? "bg-emerald-100"
                            : "bg-gray-100"
                        }`}
                      >
                        <Repeat
                          className={`h-5 w-5 ${
                            rec.active
                              ? "text-emerald-600"
                              : "text-gray-400"
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {rec.client?.company || rec.client?.name || "Unknown Client"}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              rec.active
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-gray-100 text-gray-500 border-gray-200"
                            }
                          >
                            {rec.active ? "Active" : "Paused"}
                          </Badge>
                          <Badge variant="outline">
                            {frequencyLabels[rec.frequency] || rec.frequency}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>
                            Next: {formatDate(rec.nextDate)}
                          </span>
                          <span>
                            Amount: {formatCurrency(total)}
                          </span>
                          <span>
                            {rec.templateData?.items?.length || 0} item
                            {(rec.templateData?.items?.length || 0) !== 1
                              ? "s"
                              : ""}
                          </span>
                        </div>
                        {rec.templateData?.items && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {rec.templateData.items
                              .map((i: TemplateItem) => i.description)
                              .join(", ")}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-14 sm:ml-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleMutation.mutate({
                            id: rec.id,
                            active: !rec.active,
                          })
                        }
                        disabled={toggleMutation.isPending}
                      >
                        {rec.active ? (
                          <>
                            <Pause className="h-4 w-4" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            Resume
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to delete this recurring template?"
                            )
                          ) {
                            deleteMutation.mutate(rec.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Repeat className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">
            No recurring invoices
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a recurring template to automatically generate invoices on a
            schedule.
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Recurring Template
          </Button>
        </div>
      )}
    </div>
  );
}
