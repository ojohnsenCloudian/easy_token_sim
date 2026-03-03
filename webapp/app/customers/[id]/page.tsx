"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { FilePanel } from "@/components/file-panel";
import { ConfigPanel } from "@/components/config-panel";
import { CustomerDetail, RunSummary } from "@/lib/types";
import {
  Play,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Trash2,
  MessageSquare,
  GitCompare,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface PromptOption {
  label: string;
  value: string;
  variant: "default" | "destructive";
}

interface PromptState {
  promptId: string;
  text: string;
  options: PromptOption[];
}

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    completed: { label: "Completed", className: "bg-green-100 text-green-800 border-green-200" },
    failed: { label: "Failed", className: "bg-red-100 text-red-800 border-red-200" },
    running: { label: "Running", className: "bg-blue-100 text-blue-800 border-blue-200" },
  };
  const s = map[status] ?? { label: status, className: "" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.className}`}>
      {status === "running" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
      {status === "completed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
      {status === "failed" && <XCircle className="w-3 h-3 mr-1" />}
      {s.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function duration(start: string, end: string | null) {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [liveOutput, setLiveOutput] = useState<string>("");
  const [showTerminal, setShowTerminal] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<PromptState | null>(null);
  const [respondingToPrompt, setRespondingToPrompt] = useState(false);
  const activeRunId = useRef<string>("");
  const terminalRef = useRef<HTMLDivElement>(null);

  const loadCustomer = useCallback(async () => {
    const res = await fetch(`/api/customers/${id}`);
    if (!res.ok) { router.push("/"); return; }
    const data = await res.json();
    setCustomer(data);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { loadCustomer(); }, [loadCustomer]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [liveOutput]);

  async function runSimulation() {
    setRunning(true);
    setLiveOutput("");
    setShowTerminal(true);
    setCurrentPrompt(null);
    activeRunId.current = "";

    const res = await fetch(`/api/customers/${id}/run`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to start simulation");
      setRunning(false);
      return;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let runId = "";
    let buffer = "";
    let currentEvent = "message";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line === "") {
          currentEvent = "message";
          continue;
        }
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
          continue;
        }
        if (line.startsWith("data: ")) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (currentEvent === "prompt") {
              setCurrentPrompt(payload as PromptState);
            } else if (payload.text !== undefined) {
              setLiveOutput((prev) => prev + payload.text);
            } else if (payload.runId) {
              runId = payload.runId;
              activeRunId.current = payload.runId;
            }
          } catch { /* ignore parse errors */ }
        }
      }
    }

    setCurrentPrompt(null);
    setRunning(false);
    await loadCustomer();

    if (runId) {
      toast.success("Simulation complete", {
        action: {
          label: "View Results",
          onClick: () => router.push(`/customers/${id}/runs/${runId}`),
        },
      });
    }
  }

  async function respondToPrompt(value: string) {
    const runId = activeRunId.current;
    if (!runId || !currentPrompt) return;
    setRespondingToPrompt(true);
    try {
      const res = await fetch(`/api/customers/${id}/runs/${runId}/stdin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) {
        toast.error("Failed to send input to simulation");
        return;
      }
      setCurrentPrompt(null);
    } finally {
      setRespondingToPrompt(false);
    }
  }

  async function handleDelete() {
    if (!customer) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Delete failed");
        return;
      }
      toast.success(`"${customer.name}" deleted`);
      router.push("/");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) return null;

  const allFilesReady = customer.files.ring && customer.files.status && customer.files.config;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div>
            <h2 className="text-xl font-bold">{customer.name}</h2>
            <p className="text-xs text-muted-foreground font-mono">{customer.folderName}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete customer
        </Button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{customer.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the customer and{" "}
              <span className="font-semibold text-foreground">all associated files</span>{" "}
              from disk, including uploaded ring/status/config files, run outputs, and logs.
              <br /><br />
              Folder:{" "}
              <code className="bg-muted px-1 rounded text-xs">{customer.folderName}</code>
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

      {/* Files */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Input Files
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <FilePanel
            customerId={id}
            fileType="ring"
            label="Ring Output"
            description="hsstool ring output from existing cluster node"
            exists={customer.files.ring}
            language="plaintext"
            onUpdate={loadCustomer}
          />
          <FilePanel
            customerId={id}
            fileType="status"
            label="Status Output"
            description="hsstool status output from existing cluster node"
            exists={customer.files.status}
            language="plaintext"
            onUpdate={loadCustomer}
          />
          <ConfigPanel
            customerId={id}
            exists={customer.files.config}
            onUpdate={loadCustomer}
          />
        </div>
      </div>

      {/* Run */}
      <div className="flex items-center gap-4">
        <Button
          size="lg"
          onClick={runSimulation}
          disabled={!allFilesReady || running}
          className="gap-2"
        >
          {running ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running simulation...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Simulation
            </>
          )}
        </Button>
        {!allFilesReady && (
          <p className="text-sm text-muted-foreground">
            Upload all 3 input files to enable simulation
          </p>
        )}
      </div>

      {/* Live terminal */}
      {showTerminal && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Terminal Output</CardTitle>
            {running && !currentPrompt && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Running
              </Badge>
            )}
            {currentPrompt && (
              <Badge className="text-xs flex items-center gap-1 bg-amber-100 text-amber-800 border-amber-300">
                <MessageSquare className="w-3 h-3" />
                Waiting for input
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              ref={terminalRef}
              className="bg-zinc-950 text-zinc-100 font-mono text-xs p-4 rounded-md h-64 overflow-y-auto whitespace-pre-wrap"
            >
              {liveOutput || <span className="text-zinc-500">Waiting for output...</span>}
            </div>

            {/* Interactive prompt */}
            {currentPrompt && (
              <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 rounded-md p-4">
                <div className="flex items-start gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      Simulator is waiting for your input
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      {currentPrompt.text}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {currentPrompt.options.map((opt) => (
                    <Button
                      key={opt.value}
                      size="sm"
                      variant={opt.variant === "destructive" ? "destructive" : "default"}
                      onClick={() => respondToPrompt(opt.value)}
                      disabled={respondingToPrompt}
                      className="gap-1.5"
                    >
                      {respondingToPrompt && <Loader2 className="w-3 h-3 animate-spin" />}
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Run history */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Run History
          </h3>
          {customer.runs.filter((r) => r.status === "completed").length >= 2 && (
            <Link href={`/customers/${id}/compare`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <GitCompare className="w-3.5 h-3.5" />
                Compare Runs
              </Button>
            </Link>
          )}
        </div>
        {customer.runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet</p>
        ) : (
          <Card>
            <div className="divide-y">
              {customer.runs.map((run: RunSummary) => (
                <div key={run.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <RunStatusBadge status={run.status} />
                    <div className="text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDate(run.startedAt)}
                        {run.completedAt && (
                          <span className="text-muted-foreground/60">
                            · {duration(run.startedAt, run.completedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {run.status !== "running" && (
                    <Link href={`/customers/${id}/runs/${run.id}`}>
                      <Button variant="outline" size="sm" className="gap-1 text-xs">
                        View Results
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
