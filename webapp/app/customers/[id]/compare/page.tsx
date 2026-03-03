"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerDetail, DcBalance, NodeBalance, ResultsData } from "@/lib/types";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowUp,
  ArrowDown,
  Minus,
  GitCompare,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from "recharts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortHost(host: string): string {
  const parts = host.split("_");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(parts[0])) return parts[0];
  return parts[0];
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

function devColor(pct: number) {
  if (Math.abs(pct) > 10) return "#dc2626";
  if (Math.abs(pct) > 5) return "#d97706";
  return "#16a34a";
}

function barFill(deviationPct: number, isNew: boolean, prefix: string) {
  if (isNew) return `url(#cmp-blue-${prefix})`;
  if (Math.abs(deviationPct) > 10) return `url(#cmp-red-${prefix})`;
  if (Math.abs(deviationPct) > 5) return `url(#cmp-amber-${prefix})`;
  return `url(#cmp-green-${prefix})`;
}

// ─── SVG Gradient defs (unique per chart instance) ───────────────────────────

function GradientDefs({ prefix }: { prefix: string }) {
  return (
    <svg style={{ width: 0, height: 0, position: "absolute", overflow: "hidden" }} aria-hidden>
      <defs>
        <linearGradient id={`cmp-green-${prefix}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#15803d" stopOpacity={0.85} />
        </linearGradient>
        <linearGradient id={`cmp-amber-${prefix}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#b45309" stopOpacity={0.85} />
        </linearGradient>
        <linearGradient id={`cmp-red-${prefix}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f87171" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#b91c1c" stopOpacity={0.85} />
        </linearGradient>
        <linearGradient id={`cmp-blue-${prefix}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.85} />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Single-run mini bar chart ────────────────────────────────────────────────

function MiniBarChart({ dc, prefix }: { dc: DcBalance; prefix: string }) {
  const chartData = dc.nodes.map((n) => ({ ...n, label: shortHost(n.host) }));
  const avg = dc.nodes.reduce((s, n) => s + n.rawTB, 0) / dc.nodes.length;
  const vals = dc.nodes.map((n) => n.rawTB);
  const range = Math.max(...vals) - Math.min(...vals);
  const yMin = Math.max(0, Math.min(...vals) - range * 2 - 0.3);
  const yMax = Math.max(...vals) + range * 2 + 1.2;

  return (
    <div className="rounded-lg bg-muted/20 border p-3">
      <GradientDefs prefix={prefix} />
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 48 }} barCategoryGap="35%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.07)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: "#6b7280" }}
            angle={-35}
            textAnchor="end"
            interval={0}
            height={52}
            axisLine={{ stroke: "rgba(0,0,0,0.1)" }}
            tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 9, fill: "#6b7280" }}
            tickFormatter={(v: number) => `${v.toFixed(1)}`}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            formatter={(v: number | undefined) => [v != null ? `${v.toFixed(3)} TB` : "—", "Raw TB"]}
            contentStyle={{ fontSize: 11 }}
          />
          <ReferenceLine
            y={avg}
            stroke="#f97316"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{ value: `avg ${avg.toFixed(2)}`, fontSize: 8, fill: "#f97316", position: "insideTopRight" }}
          />
          <Bar dataKey="rawTB" radius={[5, 5, 0, 0]} maxBarSize={48}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={barFill(entry.deviationPct, entry.isNew, prefix)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── DC stat pill ─────────────────────────────────────────────────────────────

function DcStatRow({ dc }: { dc: DcBalance }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <div className="text-center">
        <div className={`font-semibold ${dc.maxDeviationPct > 10 ? "text-red-600" : dc.maxDeviationPct > 5 ? "text-amber-600" : "text-emerald-600"}`}>
          {dc.maxDeviationPct.toFixed(1)}%
        </div>
        <div className="text-muted-foreground">max dev</div>
      </div>
      <div className="text-center">
        <div className="font-semibold">{dc.dcAvgPerVNode.toFixed(3)}</div>
        <div className="text-muted-foreground">avg TB/vNode</div>
      </div>
      <div className="text-center">
        <div className="font-semibold">{dc.totalTokens.toLocaleString()}</div>
        <div className="text-muted-foreground">tokens</div>
      </div>
      <div className="text-center">
        <div className="font-semibold">{dc.nodes.length}</div>
        <div className="text-muted-foreground">nodes</div>
      </div>
    </div>
  );
}

// ─── Per-node delta table ─────────────────────────────────────────────────────

interface NodeDiff {
  host: string;
  nodeA: NodeBalance | null;
  nodeB: NodeBalance | null;
  deviationDelta: number | null;
  rawTBDelta: number | null;
}

function DeltaTable({ diffs }: { diffs: NodeDiff[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Host</TableHead>
          <TableHead className="text-xs text-right">Dev A</TableHead>
          <TableHead className="text-xs text-right">Dev B</TableHead>
          <TableHead className="text-xs text-right">Change</TableHead>
          <TableHead className="text-xs text-right">Raw TB A</TableHead>
          <TableHead className="text-xs text-right">Raw TB B</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {diffs.map((d, i) => {
          const improved = d.deviationDelta !== null && d.deviationDelta < -0.1;
          const worsened = d.deviationDelta !== null && d.deviationDelta > 0.1;
          return (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs py-1.5">
                {d.nodeB?.isNew && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 align-middle" />
                )}
                {d.host}
              </TableCell>
              <TableCell className="font-mono text-xs text-right py-1.5">
                {d.nodeA ? (
                  <span style={{ color: devColor(d.nodeA.deviationPct) }}>
                    {d.nodeA.deviationPct > 0 ? "+" : ""}{d.nodeA.deviationPct.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs text-right py-1.5">
                {d.nodeB ? (
                  <span style={{ color: devColor(d.nodeB.deviationPct) }}>
                    {d.nodeB.deviationPct > 0 ? "+" : ""}{d.nodeB.deviationPct.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-xs text-right py-1.5">
                {d.deviationDelta === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : Math.abs(d.deviationDelta) < 0.1 ? (
                  <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                    <Minus className="w-3 h-3" /> 0.0%
                  </span>
                ) : improved ? (
                  <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium">
                    <ArrowDown className="w-3 h-3" />{Math.abs(d.deviationDelta).toFixed(1)}%
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-red-600 font-medium">
                    <ArrowUp className="w-3 h-3" />{Math.abs(d.deviationDelta).toFixed(1)}%
                  </span>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs text-right py-1.5 text-muted-foreground">
                {d.nodeA ? d.nodeA.rawTB.toFixed(3) : "—"}
              </TableCell>
              <TableCell className="font-mono text-xs text-right py-1.5 text-muted-foreground">
                {d.nodeB ? d.nodeB.rawTB.toFixed(3) : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ─── Run selector ─────────────────────────────────────────────────────────────

function RunSelector({
  label,
  runs,
  value,
  exclude,
  onChange,
}: {
  label: string;
  runs: CustomerDetail["runs"];
  value: string;
  exclude: string;
  onChange: (id: string) => void;
}) {
  const options = runs.filter((r) => r.status === "completed" && r.id !== exclude);
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[260px]">
          <SelectValue placeholder="Select a run…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {formatDate(r.startedAt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [resultA, setResultA] = useState<ResultsData | null>(null);
  const [resultB, setResultB] = useState<ResultsData | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  const runAId = searchParams.get("a") ?? "";
  const runBId = searchParams.get("b") ?? "";

  // Load customer + run list
  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then((r) => r.json())
      .then((d) => { setCustomer(d); setLoadingCustomer(false); })
      .catch(() => setLoadingCustomer(false));
  }, [id]);

  // Auto-select first two completed runs if URL has none
  useEffect(() => {
    if (!customer || runAId || runBId) return;
    const completed = customer.runs.filter((r) => r.status === "completed");
    if (completed.length >= 2) {
      const params = new URLSearchParams();
      params.set("a", completed[1].id); // older run
      params.set("b", completed[0].id); // newer run
      router.replace(`/customers/${id}/compare?${params.toString()}`);
    }
  }, [customer, runAId, runBId, id, router]);

  // Fetch result when run A changes
  useEffect(() => {
    if (!runAId) { setResultA(null); return; }
    setLoadingA(true);
    fetch(`/api/customers/${id}/runs/${runAId}/results`)
      .then((r) => r.json())
      .then((d) => { setResultA(d); setLoadingA(false); })
      .catch(() => setLoadingA(false));
  }, [id, runAId]);

  // Fetch result when run B changes
  useEffect(() => {
    if (!runBId) { setResultB(null); return; }
    setLoadingB(true);
    fetch(`/api/customers/${id}/runs/${runBId}/results`)
      .then((r) => r.json())
      .then((d) => { setResultB(d); setLoadingB(false); })
      .catch(() => setLoadingB(false));
  }, [id, runBId]);

  function setRunA(newId: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("a", newId);
    router.replace(`/customers/${id}/compare?${p.toString()}`);
  }

  function setRunB(newId: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("b", newId);
    router.replace(`/customers/${id}/compare?${p.toString()}`);
  }

  // Build per-DC comparisons
  const dcComparisons = useMemo(() => {
    if (!resultA || !resultB) return [];
    const allDcs = new Set([
      ...resultA.dcBalance.map((d) => d.dc),
      ...resultB.dcBalance.map((d) => d.dc),
    ]);
    return Array.from(allDcs).sort().map((dcName) => {
      const dcA = resultA.dcBalance.find((d) => d.dc === dcName) ?? null;
      const dcB = resultB.dcBalance.find((d) => d.dc === dcName) ?? null;

      // Build per-node diffs — keyed by host
      const allHosts = new Set([
        ...(dcA?.nodes.map((n) => n.host) ?? []),
        ...(dcB?.nodes.map((n) => n.host) ?? []),
      ]);
      const diffs: NodeDiff[] = Array.from(allHosts)
        .map((host) => {
          const nodeA = dcA?.nodes.find((n) => n.host === host) ?? null;
          const nodeB = dcB?.nodes.find((n) => n.host === host) ?? null;
          const deviationDelta =
            nodeA && nodeB ? nodeB.deviationPct - nodeA.deviationPct : null;
          const rawTBDelta =
            nodeA && nodeB ? nodeB.rawTB - nodeA.rawTB : null;
          return { host, nodeA, nodeB, deviationDelta, rawTBDelta };
        })
        // Sort: biggest absolute deviation change first
        .sort((a, b) =>
          Math.abs(b.deviationDelta ?? 0) - Math.abs(a.deviationDelta ?? 0)
        );

      return { dc: dcName, dcA, dcB, diffs };
    });
  }, [resultA, resultB]);

  // Overall summary stats
  const summaryA = useMemo(() => {
    if (!resultA) return null;
    const maxDev = Math.max(...resultA.dcBalance.map((d) => d.maxDeviationPct), 0);
    const allGood = resultA.dcBalance.every((d) => d.isGoodBalance);
    const newNodes = resultA.dcBalance.reduce((s, d) => s + d.nodes.filter((n) => n.isNew).length, 0);
    return { maxDev, allGood, newNodes };
  }, [resultA]);

  const summaryB = useMemo(() => {
    if (!resultB) return null;
    const maxDev = Math.max(...resultB.dcBalance.map((d) => d.maxDeviationPct), 0);
    const allGood = resultB.dcBalance.every((d) => d.isGoodBalance);
    const newNodes = resultB.dcBalance.reduce((s, d) => s + d.nodes.filter((n) => n.isNew).length, 0);
    return { maxDev, allGood, newNodes };
  }, [resultB]);

  if (loadingCustomer) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) return null;

  const completedRuns = customer.runs.filter((r) => r.status === "completed");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/customers/${id}`)}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-muted-foreground" />
          <div>
            <h2 className="text-xl font-bold">{customer.name} — Compare Runs</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{completedRuns.length} completed run{completedRuns.length !== 1 ? "s" : ""} available</p>
          </div>
        </div>
      </div>

      {completedRuns.length < 2 ? (
        <div className="text-center py-24 text-muted-foreground">
          <GitCompare className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Not enough runs to compare</p>
          <p className="text-sm mt-1">You need at least 2 completed runs to use this feature.</p>
        </div>
      ) : (
        <>
          {/* Run pickers */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-wrap items-end gap-6">
                <RunSelector
                  label="Run A (baseline)"
                  runs={customer.runs}
                  value={runAId}
                  exclude={runBId}
                  onChange={setRunA}
                />
                <div className="flex items-center self-center pb-1">
                  <span className="text-2xl font-light text-muted-foreground px-2">vs</span>
                </div>
                <RunSelector
                  label="Run B (compare)"
                  runs={customer.runs}
                  value={runBId}
                  exclude={runAId}
                  onChange={setRunB}
                />
                {resultA && resultB && (
                  <div className="ml-auto text-xs text-muted-foreground self-end pb-2">
                    {dcComparisons.length} DC{dcComparisons.length !== 1 ? "s" : ""} compared
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Loading */}
          {(loadingA || loadingB) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading results…
            </div>
          )}

          {/* Summary banner */}
          {summaryA && summaryB && !loadingA && !loadingB && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Run A — baseline", summary: summaryA, run: resultA!.run },
                { label: "Run B — compare", summary: summaryB, run: resultB!.run },
              ].map(({ label, summary, run }, idx) => (
                <Card key={idx} className={idx === 0 ? "border-slate-300 dark:border-slate-600" : "border-primary/50"}>
                  <CardContent className="pt-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{formatDate(run.startedAt)}</p>
                    <div className="flex flex-wrap gap-4 pt-1">
                      <div>
                        <div className={`text-2xl font-bold ${summary.maxDev > 10 ? "text-red-600" : summary.maxDev > 5 ? "text-amber-600" : "text-emerald-600"}`}>
                          {summary.maxDev.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">max deviation</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{summary.newNodes}</div>
                        <div className="text-xs text-muted-foreground">new nodes</div>
                      </div>
                      <div className="flex items-center">
                        {summary.allGood ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="text-sm">Good balance</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-red-600 font-medium">
                            <XCircle className="w-5 h-5" />
                            <span className="text-sm">Needs tuning</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Per-DC comparisons */}
          {!loadingA && !loadingB && dcComparisons.length > 0 && (
            <div className="space-y-6">
              {dcComparisons.map(({ dc, dcA, dcB, diffs }) => (
                <Card key={dc}>
                  <CardHeader className="pb-2 pt-5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-sm">{dc}</Badge>
                      {dcA && (
                        dcA.isGoodBalance ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-300 border rounded-full px-2 py-0.5">
                            A: <TrendingUp className="w-3 h-3 text-emerald-500" /> Good
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-300 border rounded-full px-2 py-0.5">
                            A: <TrendingDown className="w-3 h-3 text-red-500" /> Needs tuning
                          </span>
                        )
                      )}
                      {dcB && (
                        dcB.isGoodBalance ? (
                          <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                            B: <TrendingUp className="w-3 h-3 text-emerald-500" /> Good
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                            B: <TrendingDown className="w-3 h-3 text-red-500" /> Needs tuning
                          </span>
                        )
                      )}
                      {/* Overall change indicator */}
                      {dcA && dcB && (() => {
                        const delta = dcB.maxDeviationPct - dcA.maxDeviationPct;
                        if (Math.abs(delta) < 0.1) return null;
                        return delta < 0 ? (
                          <span className="ml-auto text-xs font-medium text-emerald-600 inline-flex items-center gap-1">
                            <ArrowDown className="w-3.5 h-3.5" /> max dev improved by {Math.abs(delta).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="ml-auto text-xs font-medium text-red-600 inline-flex items-center gap-1">
                            <ArrowUp className="w-3.5 h-3.5" /> max dev worsened by {Math.abs(delta).toFixed(1)}%
                          </span>
                        );
                      })()}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Side-by-side charts */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Run A — Baseline</p>
                          {dcA && <DcStatRow dc={dcA} />}
                        </div>
                        {dcA ? (
                          <MiniBarChart dc={dcA} prefix={`a-${dc}`} />
                        ) : (
                          <div className="rounded-lg bg-muted/20 border p-6 text-center text-xs text-muted-foreground">
                            DC not present in Run A
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Run B — Compare</p>
                          {dcB && <DcStatRow dc={dcB} />}
                        </div>
                        {dcB ? (
                          <MiniBarChart dc={dcB} prefix={`b-${dc}`} />
                        ) : (
                          <div className="rounded-lg bg-muted/20 border p-6 text-center text-xs text-muted-foreground">
                            DC not present in Run B
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Delta table */}
                    {diffs.length > 0 && dcA && dcB && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Per-node changes
                        </p>
                        <DeltaTable diffs={diffs} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* No balance data */}
          {!loadingA && !loadingB && resultA && resultB && dcComparisons.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No balance data available for these runs.</p>
              <p className="text-xs mt-1">Balance data is generated when the simulation produces DC balance output.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
