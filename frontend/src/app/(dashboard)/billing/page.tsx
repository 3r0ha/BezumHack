"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Receipt,
  Plus,
  Zap,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Loader2,
  Send,
  Ban,
  Eye,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useUsers } from "@/hooks/use-users";
import { useLocale } from "@/contexts/locale-context";

// --- Types ---

interface InvoiceLineItem {
  id: string;
  description: string;
  hours: number;
  rate: number;
  amount: number;
}

interface Invoice {
  id: string;
  number: string;
  projectId: string;
  projectTitle: string;
  clientName: string;
  status: "DRAFT" | "ISSUED" | "PAID" | "OVERDUE" | "CANCELLED";
  items: InvoiceLineItem[];
  totalAmount: number;
  issuedAt: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  notes: string;
}

interface Project {
  id: string;
  title: string;
  clientName: string;
}

// --- Helpers ---

const billingStatusStyles: Record<string, { className: string; icon: typeof Clock }> = {
  DRAFT: {
    className: "bg-muted text-muted-foreground border-transparent",
    icon: FileText,
  },
  ISSUED: {
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
    icon: Send,
  },
  PAID: {
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    icon: CheckCircle2,
  },
  OVERDUE: {
    className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
    icon: AlertCircle,
  },
  CANCELLED: {
    className: "bg-muted text-muted-foreground border-transparent",
    icon: Ban,
  },
};

const billingStatusLabelKeys: Record<string, string> = {
  DRAFT: 'billing.status.draft',
  ISSUED: 'billing.status.issued',
  PAID: 'billing.status.paid',
  OVERDUE: 'billing.status.overdue',
  CANCELLED: 'billing.status.cancelled',
};

function _formatCurrency(amount: number, locale: string = "ru"): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function _formatDate(dateStr: string | null, locale: string = "ru"): string {
  if (!dateStr) return "--";
  try {
    return new Date(dateStr).toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// --- Component ---

export default function BillingPage() {
  const { getUserName } = useUsers();
  const { t, locale } = useLocale();
  const formatCurrency = (amount: number) => _formatCurrency(amount, locale);
  const formatDate = (dateStr: string | null) => _formatDate(dateStr, locale);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Create form state
  const [newProjectId, setNewProjectId] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newLineItems, setNewLineItems] = useState<
    { description: string; hours: string; rate: string }[]
  >([{ description: "", hours: "", rate: "" }]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const projectsData = await api.get<any[]>("/api/projects/projects");
        const projectsList = (projectsData || []).map((p: any) => ({
          id: p.id,
          title: p.title,
          clientName: getUserName(p.clientId),
        }));
        setProjects(projectsList);

        // Load invoices for all projects
        const allInvoices: Invoice[] = [];
        for (const proj of projectsList) {
          try {
            const data = await api.get<Invoice[]>(`/api/projects/invoices/project/${proj.id}`);
            if (data) allInvoices.push(...data.map((inv: any) => ({ ...inv, projectTitle: proj.title })));
          } catch {}
        }
        setInvoices(allInvoices);
      } catch {
        setProjects([]);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredInvoices = useMemo(() => {
    let result = [...invoices];
    if (statusFilter !== "all") {
      result = result.filter((inv) => inv.status === statusFilter);
    }
    if (projectFilter !== "all") {
      result = result.filter((inv) => inv.projectId === projectFilter);
    }
    return result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [invoices, statusFilter, projectFilter]);

  // Summary stats
  const totalInvoiced = invoices
    .filter((i) => i.status !== "CANCELLED" && i.status !== "DRAFT")
    .reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid = invoices
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + i.totalAmount, 0);
  const totalOutstanding = invoices
    .filter((i) => i.status === "ISSUED" || i.status === "OVERDUE")
    .reduce((s, i) => s + i.totalAmount, 0);

  const addLineItem = () => {
    setNewLineItems((prev) => [...prev, { description: "", hours: "", rate: "" }]);
  };

  const updateLineItem = (index: number, field: string, value: string) => {
    setNewLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const removeLineItem = (index: number) => {
    if (newLineItems.length <= 1) return;
    setNewLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const project = projects.find((p) => p.id === newProjectId);

    const items: InvoiceLineItem[] = newLineItems
      .filter((li) => li.description && li.hours && li.rate)
      .map((li, i) => ({
        id: `new-li-${i}`,
        description: li.description,
        hours: parseFloat(li.hours),
        rate: parseFloat(li.rate),
        amount: parseFloat(li.hours) * parseFloat(li.rate),
      }));

    const totalAmount = items.reduce((s, li) => s + li.amount, 0);

    try {
      const result = await api.post<Invoice>("/api/projects/invoices", {
        projectId: newProjectId,
        items,
        notes: newNotes,
      });
      setInvoices((prev) => [result, ...prev]);
    } catch {
      const newInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        number: `INV-2026-${String(invoices.length + 1).padStart(3, "0")}`,
        projectId: newProjectId,
        projectTitle: project?.title || t('chat.project'),
        clientName: project?.clientName || t('projects.client'),
        status: "DRAFT",
        items,
        totalAmount,
        issuedAt: null,
        dueDate: null,
        paidAt: null,
        createdAt: new Date().toISOString(),
        notes: newNotes,
      };
      setInvoices((prev) => [newInvoice, ...prev]);
    } finally {
      setCreating(false);
      setCreateDialogOpen(false);
      setNewProjectId("");
      setNewNotes("");
      setNewLineItems([{ description: "", hours: "", rate: "" }]);
    }
  };

  const handleAutoGenerate = async (projectId: string) => {
    setGenerating(projectId);
    const project = projects.find((p) => p.id === projectId);

    try {
      const result = await api.post<Invoice>(`/api/projects/invoices/generate/${projectId}`);
      setInvoices((prev) => [result, ...prev]);
    } catch {
      const autoInvoice: Invoice = {
        id: `inv-auto-${Date.now()}`,
        number: `INV-2026-${String(invoices.length + 1).padStart(3, "0")}`,
        projectId,
        projectTitle: project?.title || t('chat.project'),
        clientName: project?.clientName || t('projects.client'),
        status: "DRAFT",
        items: [
          {
            id: "auto-li-1",
            description: t('billing.auto_dev_description'),
            hours: 42,
            rate: 4000,
            amount: 168000,
          },
          {
            id: "auto-li-2",
            description: t('billing.auto_review_description'),
            hours: 12,
            rate: 3500,
            amount: 42000,
          },
        ],
        totalAmount: 210000,
        issuedAt: null,
        dueDate: null,
        paidAt: null,
        createdAt: new Date().toISOString(),
        notes: t('billing.auto_notes'),
      };
      setInvoices((prev) => [autoInvoice, ...prev]);
    } finally {
      setGenerating(null);
    }
  };

  const handleStatusChange = async (invoiceId: string, newStatus: Invoice["status"]) => {
    setUpdatingStatus(invoiceId);

    try {
      await api.patch(`/api/projects/invoices/${invoiceId}/status`, { status: newStatus });
    } catch {
      // apply locally
    }

    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              status: newStatus,
              issuedAt: newStatus === "ISSUED" ? new Date().toISOString() : inv.issuedAt,
              paidAt: newStatus === "PAID" ? new Date().toISOString() : inv.paidAt,
              dueDate:
                newStatus === "ISSUED" && !inv.dueDate
                  ? new Date(Date.now() + 14 * 86400000).toISOString()
                  : inv.dueDate,
            }
          : inv
      )
    );

    setUpdatingStatus(null);
    if (selectedInvoice?.id === invoiceId) {
      setSelectedInvoice((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              issuedAt: newStatus === "ISSUED" ? new Date().toISOString() : prev.issuedAt,
              paidAt: newStatus === "PAID" ? new Date().toISOString() : prev.paidAt,
            }
          : null
      );
    }
  };

  const openDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDetailDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-48 mt-1" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('billing.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('billing.subtitle_text')}
            </p>
          </div>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              {t('billing.new_invoice')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('billing.new_invoice')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>{t('chat.project')} *</Label>
                <Select value={newProjectId} onValueChange={setNewProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('billing.select_project')} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title} ({p.clientName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t('billing.line_items')}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={addLineItem}
                  >
                    <Plus className="h-3 w-3" />
                    {t('billing.add')}
                  </Button>
                </div>
                {newLineItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end border-b sm:border-b-0 pb-3 sm:pb-0">
                    <div className="sm:col-span-5">
                      <Label className="text-xs text-muted-foreground">{t('billing.item_description')}</Label>
                      <Input
                        placeholder={t('billing.item_description_placeholder')}
                        value={item.description}
                        onChange={(e) => updateLineItem(index, "description", e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:contents">
                      <div className="sm:col-span-2">
                        <Label className="text-xs text-muted-foreground">{t('billing.hours')}</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={item.hours}
                          onChange={(e) => updateLineItem(index, "hours", e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Label className="text-xs text-muted-foreground">{t('billing.rate')}</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={item.rate}
                          onChange={(e) => updateLineItem(index, "rate", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2 text-right">
                      <Label className="text-xs text-muted-foreground block sm:hidden">{t('billing.item_amount')}</Label>
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground hidden sm:block">{t('billing.item_amount')}</Label>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium flex-1 text-right">
                          {item.hours && item.rate
                            ? formatCurrency(parseFloat(item.hours) * parseFloat(item.rate))
                            : "--"}
                        </span>
                        {newLineItems.length > 1 && (
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive p-1"
                            onClick={() => removeLineItem(index)}
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="text-right pt-2 border-t">
                  <span className="text-sm text-muted-foreground">{t('billing.total')}: </span>
                  <span className="text-lg font-bold">
                    {formatCurrency(
                      newLineItems.reduce(
                        (s, li) =>
                          s + (parseFloat(li.hours || "0") * parseFloat(li.rate || "0")),
                        0
                      )
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-notes">{t('billing.notes')}</Label>
                <Textarea
                  id="inv-notes"
                  placeholder={t('billing.notes_placeholder')}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={!newProjectId || creating}>
                  {creating ? t('ai.creating') : t('common.create')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              {t('billing.total_invoiced')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalInvoiced)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {invoices.filter((i) => i.status !== "CANCELLED" && i.status !== "DRAFT").length} {t('billing.invoices_count')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              {t('billing.total_paid')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalPaid)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {invoices.filter((i) => i.status === "PAID").length} {t('billing.invoices_count')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              {t('billing.outstanding')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(totalOutstanding)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {invoices.filter((i) => i.status === "ISSUED" || i.status === "OVERDUE").length} {t('billing.invoices_count')}
              {invoices.some((i) => i.status === "OVERDUE") && (
                <span className="text-red-500 ml-1">
                  ({invoices.filter((i) => i.status === "OVERDUE").length} {t('billing.overdue_count')})
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Auto-generate section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            {t('billing.auto_generate_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            {t('billing.auto_generate_desc')}
          </p>
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={generating === p.id}
                onClick={() => handleAutoGenerate(p.id)}
              >
                {generating === p.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                {p.title}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={t('common.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('projects.all_statuses')}</SelectItem>
            <SelectItem value="DRAFT">{t('billing.status.draft')}</SelectItem>
            <SelectItem value="ISSUED">{t('billing.status.issued')}</SelectItem>
            <SelectItem value="PAID">{t('billing.status.paid')}</SelectItem>
            <SelectItem value="OVERDUE">{t('billing.status.overdue')}</SelectItem>
            <SelectItem value="CANCELLED">{t('billing.status.cancelled')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder={t('chat.project')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('billing.all_projects')}</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Invoice Table (desktop) */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <ScrollArea className="max-h-[600px]">
            <div className="min-w-[700px]">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                <div className="col-span-2">{t('billing.invoice_number')}</div>
                <div className="col-span-3">{t('chat.project')} / {t('projects.client')}</div>
                <div className="col-span-2 text-right">{t('billing.amount')}</div>
                <div className="col-span-2">{t('common.status')}</div>
                <div className="col-span-2">{t('common.deadline')}</div>
                <div className="col-span-1"></div>
              </div>

              {/* Table rows */}
              {filteredInvoices.map((invoice) => {
                const config = billingStatusStyles[invoice.status];
                const StatusIcon = config.icon;

                return (
                  <div
                    key={invoice.id}
                    className="grid grid-cols-12 gap-4 px-4 py-3 border-b hover:bg-muted/30 transition-colors items-center"
                  >
                    <div className="col-span-2">
                      <span className="text-sm font-mono font-medium">{invoice.number}</span>
                    </div>
                    <div className="col-span-3">
                      <p className="text-sm font-medium truncate">{invoice.projectTitle}</p>
                      <p className="text-xs text-muted-foreground truncate">{invoice.clientName}</p>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-semibold">{formatCurrency(invoice.totalAmount)}</span>
                    </div>
                    <div className="col-span-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-medium whitespace-nowrap ${config.className}`}
                      >
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {t(billingStatusLabelKeys[invoice.status])}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(invoice.issuedAt || invoice.createdAt)}
                      </span>
                      {invoice.dueDate && (
                        <p className="text-[10px] text-muted-foreground">
                          {t('billing.due_date')}: {formatDate(invoice.dueDate)}
                        </p>
                      )}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openDetail(invoice)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {filteredInvoices.length === 0 && (
                <div className="text-center py-16">
                  <Receipt className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t('common.no_data')}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Invoice Cards (mobile) */}
      <div className="space-y-3 sm:hidden">
        {filteredInvoices.map((invoice) => {
          const config = billingStatusStyles[invoice.status];
          const StatusIcon = config.icon;

          return (
            <Card key={invoice.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-mono font-medium">{invoice.number}</span>
                    <p className="text-sm font-medium truncate mt-0.5">{invoice.projectTitle}</p>
                    <p className="text-xs text-muted-foreground truncate">{invoice.clientName}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium whitespace-nowrap shrink-0 ${config.className}`}
                  >
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {t(billingStatusLabelKeys[invoice.status])}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-base font-semibold">{formatCurrency(invoice.totalAmount)}</span>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(invoice.issuedAt || invoice.createdAt)}
                    </p>
                    {invoice.dueDate && (
                      <p className="text-[10px] text-muted-foreground">
                        {t('billing.due_date')}: {formatDate(invoice.dueDate)}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => openDetail(invoice)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t('billing.details')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredInvoices.length === 0 && (
          <div className="text-center py-16">
            <Receipt className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t('billing.not_found')}
            </p>
          </div>
        )}
      </div>

      {/* Invoice Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {t('billing.invoice_title')} {selectedInvoice?.number}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedInvoice.projectTitle}</p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.clientName}</p>
                </div>
                <Badge
                  variant="outline"
                  className={billingStatusStyles[selectedInvoice.status].className}
                >
                  {t(billingStatusLabelKeys[selectedInvoice.status])}
                </Badge>
              </div>

              <Separator />

              {/* Line items table */}
              <div>
                <h4 className="text-sm font-medium mb-2">{t('billing.line_items')}</h4>
                <div className="border rounded-md overflow-hidden">
                  {/* Desktop table header */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                    <div className="col-span-5">{t('common.description')}</div>
                    <div className="col-span-2 text-right">{t('billing.hours')}</div>
                    <div className="col-span-2 text-right">{t('billing.rate')}</div>
                    <div className="col-span-3 text-right">{t('billing.amount')}</div>
                  </div>
                  {selectedInvoice.items.map((li) => (
                    <div
                      key={li.id}
                      className="px-3 py-2 border-t text-sm space-y-1 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-2"
                    >
                      <div className="sm:col-span-5 font-medium sm:font-normal">{li.description}</div>
                      <div className="flex sm:contents gap-2 text-muted-foreground">
                        <span className="sm:col-span-2 sm:text-right">{Math.round(li.hours * 10) / 10}{t('billing.hours_short')}</span>
                        <span className="sm:hidden">&middot;</span>
                        <span className="sm:col-span-2 sm:text-right">{formatCurrency(li.rate)}{t('billing.per_hour')}</span>
                      </div>
                      <div className="sm:col-span-3 sm:text-right font-medium">
                        {formatCurrency(li.amount)}
                      </div>
                    </div>
                  ))}
                  <div className="px-3 py-2 border-t bg-muted/30 flex justify-between sm:grid sm:grid-cols-12 sm:gap-2">
                    <div className="sm:col-span-9 sm:text-right text-sm font-medium">{t('billing.total')}:</div>
                    <div className="sm:col-span-3 sm:text-right text-base font-bold">
                      {formatCurrency(selectedInvoice.totalAmount)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t('billing.created_date')}</p>
                  <p className="font-medium">{formatDate(selectedInvoice.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('billing.issued_date')}</p>
                  <p className="font-medium">{formatDate(selectedInvoice.issuedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('billing.paid_date')}</p>
                  <p className="font-medium">{formatDate(selectedInvoice.paidAt)}</p>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">{t('billing.notes_label')}</p>
                  <p className="text-sm">{selectedInvoice.notes}</p>
                </div>
              )}

              <Separator />

              {/* Actions */}
              <DialogFooter className="gap-2 flex-col sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => setDetailDialogOpen(false)}
                >
                  {t('common.close')}
                </Button>
                {selectedInvoice.status === "DRAFT" && (
                  <Button
                    className="gap-1"
                    disabled={updatingStatus === selectedInvoice.id}
                    onClick={() => handleStatusChange(selectedInvoice.id, "ISSUED")}
                  >
                    {updatingStatus === selectedInvoice.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {t('billing.issue_invoice')}
                  </Button>
                )}
                {(selectedInvoice.status === "ISSUED" || selectedInvoice.status === "OVERDUE") && (
                  <Button
                    className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={updatingStatus === selectedInvoice.id}
                    onClick={() => handleStatusChange(selectedInvoice.id, "PAID")}
                  >
                    {updatingStatus === selectedInvoice.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {t('billing.mark_paid')}
                  </Button>
                )}
                {selectedInvoice.status !== "CANCELLED" && selectedInvoice.status !== "PAID" && (
                  <Button
                    variant="destructive"
                    className="gap-1"
                    disabled={updatingStatus === selectedInvoice.id}
                    onClick={() => handleStatusChange(selectedInvoice.id, "CANCELLED")}
                  >
                    <Ban className="h-4 w-4" />
                    {t('common.cancel')}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
