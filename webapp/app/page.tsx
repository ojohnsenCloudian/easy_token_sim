"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerSummary } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Folder,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Trash2,
  Search,
  X,
  ChevronLeft,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const PAGE_SIZE_OPTIONS = [12, 24, 48];

function FileStatusDot({ exists }: { exists: boolean }) {
  return exists ? (
    <CheckCircle2 className="w-4 h-4 text-green-500" />
  ) : (
    <XCircle className="w-4 h-4 text-muted-foreground" />
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
    completed: "default",
    failed: "destructive",
    running: "secondary",
  };
  return (
    <Badge variant={variants[status] ?? "outline"} className="text-xs">
      {status}
    </Badge>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function PaginationBar({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  // Build page numbers with ellipsis: always show first, last, current ±1
  const pages: (number | "…")[] = [];
  const add = (n: number) => {
    if (!pages.includes(n)) pages.push(n);
  };
  add(1);
  if (page > 3) pages.push("…");
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) add(i);
  if (page < totalPages - 2) pages.push("…");
  if (totalPages > 1) add(totalPages);

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <Button
        variant="outline"
        size="sm"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className="gap-1"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Prev
      </Button>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-sm select-none">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="sm"
            className="w-9"
            onClick={() => onChange(p as number)}
          >
            {p}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className="gap-1"
      >
        Next
        <ChevronRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export default function HomePage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomerSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(12);

  async function loadCustomers() {
    const res = await fetch("/api/customers");
    const data = await res.json();
    setCustomers(data);
    setLoading(false);
  }

  useEffect(() => { loadCustomers(); }, []);

  // Reset to page 1 when search or page size changes
  useEffect(() => { setPage(1); }, [search, pageSize]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.folderName.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to create customer");
        return;
      }
      setOpen(false);
      setName("");
      toast.success("Customer created");
      loadCustomers();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Delete failed");
        return;
      }
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      loadCustomers();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Customers</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage expansion simulations per customer
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="customer-name">Customer name</Label>
                <Input
                  id="customer-name"
                  placeholder="e.g. acme-corp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
                {name.trim() && (
                  <p className="text-xs text-muted-foreground">
                    Folder will be created:{" "}
                    <code className="bg-muted px-1 rounded">
                      {name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-")}
                      -{new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}
                    </code>
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!name.trim() || creating}>
                  {creating ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + filters bar */}
      {!loading && customers.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search customers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>
              {search
                ? `${filtered.length} of ${customers.length}`
                : customers.length}{" "}
              customer{customers.length !== 1 ? "s" : ""}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v))}
            >
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {n} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-muted-foreground text-sm">Loading...</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <Folder className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No customers yet</p>
          <p className="text-sm mt-1">Create your first customer to get started</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <Search className="w-10 h-10 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No results for &ldquo;{search}&rdquo;</p>
          <p className="text-sm mt-1">
            Try a different name or{" "}
            <button className="underline hover:text-foreground" onClick={() => setSearch("")}>
              clear the search
            </button>
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginated.map((c) => (
              <div key={c.id} className="relative group">
                <Link href={`/customers/${c.id}`}>
                  <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{c.name}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1 font-mono">
                            {c.folderName}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileStatusDot exists={c.files.ring} /> Ring
                        </span>
                        <span className="flex items-center gap-1">
                          <FileStatusDot exists={c.files.status} /> Status
                        </span>
                        <span className="flex items-center gap-1">
                          <FileStatusDot exists={c.files.config} /> Config
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(c.createdAt)}
                        </span>
                        {c.lastRun ? (
                          <RunStatusBadge status={c.lastRun.status} />
                        ) : (
                          <span className="text-muted-foreground/60">No runs yet</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                <button
                  className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border text-muted-foreground hover:text-destructive hover:border-destructive"
                  title="Delete customer"
                  onClick={(e) => { e.preventDefault(); setDeleteTarget(c); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center gap-2">
            <PaginationBar page={page} totalPages={totalPages} onChange={setPage} />
            {totalPages > 1 && (
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · showing{" "}
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
              </p>
            )}
          </div>
        </>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the customer and{" "}
              <span className="font-semibold text-foreground">all associated files</span>{" "}
              from disk, including uploaded ring/status/config files, run outputs, and logs.
              <br /><br />
              Folder:{" "}
              <code className="bg-muted px-1 rounded text-xs">{deleteTarget?.folderName}</code>
              <br />
              <span className="text-destructive font-medium">This cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete customer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
