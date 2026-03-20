"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { DcBalance, NodeBalance, ResultsData } from "@/lib/types";
import {
  ArrowLeft,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  Database,
  Network,
  Server,
  FileDown,
  BarChart2,
  TrendingUp,
  TrendingDown,
  FolderArchive,
  AlertTriangle,
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
  LabelList,
} from "recharts";

// Shorten a host name to a readable label for the chart X-axis
function shortHost(host: string): string {
  // Remove trailing rack/dc segments like "_oslo_dc1_rack1"
  const parts = host.split("_");
  // If it looks like an IP with extra segments, return just the IP
  if (/^\d+\.\d+\.\d+\.\d+$/.test(parts[0])) return parts[0];
  return parts[0];
}

interface DcBalanceTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: NodeBalance & { label: string } }>;
}

function DcBalanceTooltip({ active, payload }: DcBalanceTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const devColor =
    Math.abs(d.deviationPct) > 10
      ? "text-red-500"
      : Math.abs(d.deviationPct) > 5
      ? "text-amber-500"
      : "text-emerald-500";
  return (
    <div className="bg-background/95 backdrop-blur border rounded-xl shadow-xl p-3.5 text-xs space-y-2 min-w-[200px]">
      <div className="flex items-center gap-2">
        <p className="font-semibold text-sm truncate">{d.host}</p>
        {d.isNew && (
          <span className="shrink-0 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
            NEW
          </span>
        )}
      </div>
      <div className="border-t pt-2 space-y-1.5">
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">Raw ownership</span>
          <span className="font-mono font-semibold">{d.rawTB.toFixed(3)} TB</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">vNodes / tokens</span>
          <span className="font-mono">{d.tokens}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">Avg / vNode</span>
          <span className="font-mono">{d.avgPerVNode.toFixed(3)} TB</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">Deviation</span>
          <span className={`font-mono font-semibold ${devColor}`}>
            {d.deviationPct > 0 ? "+" : ""}{d.deviationPct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function getBarFill(deviationPct: number, isNew: boolean, dcId: string): string {
  if (isNew) return `url(#g-blue-${dcId})`;
  if (Math.abs(deviationPct) > 10) return `url(#g-red-${dcId})`;
  if (Math.abs(deviationPct) > 5) return `url(#g-amber-${dcId})`;
  return `url(#g-green-${dcId})`;
}

function GradientDefs({ id }: { id: string }) {
  return (
    <svg style={{ width: 0, height: 0, position: "absolute", overflow: "hidden" }} aria-hidden>
      <defs>
        <linearGradient id={`g-green-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#15803d" stopOpacity={0.85} />
        </linearGradient>
        <linearGradient id={`g-amber-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#b45309" stopOpacity={0.85} />
        </linearGradient>
        <linearGradient id={`g-red-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f87171" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#b91c1c" stopOpacity={0.85} />
        </linearGradient>
        <linearGradient id={`g-blue-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.85} />
        </linearGradient>
      </defs>
    </svg>
  );
}

function DcBalanceChart({ dc }: { dc: DcBalance }) {
  const dcId = dc.dc.replace(/[^a-z0-9]/gi, "-");
  const avg = dc.nodes.reduce((s, n) => s + n.rawTB, 0) / dc.nodes.length;

  const chartData = dc.nodes.map((n) => ({
    ...n,
    label: shortHost(n.host),
  }));

  const minTB = Math.min(...dc.nodes.map((n) => n.rawTB));
  const maxTB = Math.max(...dc.nodes.map((n) => n.rawTB));
  const range = maxTB - minTB;
  const yMin = Math.max(0, minTB - range * 2 - 0.5);
  const yMax = maxTB + range * 2 + 1.5;

  const newNodes = dc.nodes.filter((n) => n.isNew).length;

  const renderDevLabel = (props: {
    x?: number | string; y?: number | string; width?: number | string; value?: number | string;
  }) => {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const width = Number(props.width ?? 0);
    const value = props.value !== undefined ? Number(props.value) : undefined;
    if (value === undefined || isNaN(value)) return null;
    const color =
      Math.abs(value) > 10 ? "#dc2626" : Math.abs(value) > 5 ? "#d97706" : "#16a34a";
    return (
      <text
        x={x + width / 2}
        y={y - 5}
        textAnchor="middle"
        fontSize={9}
        fill={color}
        fontWeight={Math.abs(value) > 5 ? 700 : 400}
      >
        {value > 0 ? "+" : ""}{value.toFixed(1)}%
      </text>
    );
  };

  return (
    <div className="space-y-4">
      <GradientDefs id={dcId} />

      {/* DC header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="font-mono text-sm px-2 py-0.5">{dc.dc}</Badge>
            {dc.isGoodBalance ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                <TrendingUp className="w-3 h-3" /> Good balance
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                <TrendingDown className="w-3 h-3" /> Imbalanced
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{dc.storagePolicy}</p>
        </div>
        <div className="flex gap-4 text-xs">
          <div className="text-right">
            <div className="font-semibold text-foreground">{dc.totalTokens.toLocaleString()}</div>
            <div className="text-muted-foreground">total tokens</div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-foreground">{dc.dcAvgPerVNode.toFixed(3)} TB</div>
            <div className="text-muted-foreground">avg / vNode</div>
          </div>
          <div className="text-right">
            <div className={`font-semibold ${dc.maxDeviationPct > 10 ? "text-red-600" : dc.maxDeviationPct > 5 ? "text-amber-600" : "text-green-600"}`}>
              {dc.maxDeviationPct.toFixed(1)}%
            </div>
            <div className="text-muted-foreground">max deviation</div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-foreground">{dc.deviatingHostsCount}</div>
            <div className="text-muted-foreground">hosts &gt;10% off</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {newNodes > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span>New nodes ({newNodes})</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span>Within ±5%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-400" />
          <span>5–10% off</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-400" />
          <span>&gt;10% off</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-7 border-t-2 border-dashed border-orange-400" />
          <span>DC average</span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="rounded-xl bg-muted/20 border p-4">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 22, right: 24, left: 8, bottom: 52 }} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.07)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={56}
              axisLine={{ stroke: "rgba(0,0,0,0.1)" }}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickFormatter={(v: number) => `${v.toFixed(1)}`}
              axisLine={false}
              tickLine={false}
              label={{ value: "Raw TB", angle: -90, position: "insideLeft", fontSize: 10, fill: "#9ca3af", dx: -4 }}
            />
            <Tooltip content={<DcBalanceTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)", radius: 4 }} />
            <ReferenceLine
              y={avg}
              stroke="#f97316"
              strokeDasharray="5 3"
              strokeWidth={2}
              label={{ value: `avg ${avg.toFixed(2)} TB`, fontSize: 9, fill: "#f97316", position: "insideTopRight" }}
            />
            <Bar dataKey="rawTB" radius={[6, 6, 0, 0]} maxBarSize={56}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <LabelList dataKey="deviationPct" content={renderDevLabel as any} />
              {chartData.map((entry, i) => (
                <Cell key={i} fill={getBarFill(entry.deviationPct, entry.isNew, dcId)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Node table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Host</TableHead>
            <TableHead className="text-xs text-right">Raw TB</TableHead>
            <TableHead className="text-xs text-right">vNodes</TableHead>
            <TableHead className="text-xs text-right">Avg TB/vNode</TableHead>
            <TableHead className="text-xs text-right">Deviation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dc.nodes.map((node, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs py-1.5">
                {node.isNew && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 align-middle" />
                )}
                {node.host}
              </TableCell>
              <TableCell className="font-mono text-xs text-right py-1.5">{node.rawTB.toFixed(3)}</TableCell>
              <TableCell className="font-mono text-xs text-right py-1.5">{node.tokens}</TableCell>
              <TableCell className="font-mono text-xs text-right py-1.5">{node.avgPerVNode.toFixed(3)}</TableCell>
              <TableCell className={`font-mono text-xs text-right py-1.5 font-medium ${Math.abs(node.deviationPct) > 10 ? "text-red-600" : Math.abs(node.deviationPct) > 5 ? "text-amber-600" : "text-emerald-600"}`}>
                {node.deviationPct > 0 ? "+" : ""}{node.deviationPct.toFixed(1)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "destructive" | "secondary" }> =
    {
      completed: { label: "Completed", variant: "default" },
      failed: { label: "Failed", variant: "destructive" },
      running: { label: "Running", variant: "secondary" },
    };
  const s = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ResultsPage() {
  const { id, runId } = useParams<{ id: string; runId: string }>();
  const router = useRouter();
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/customers/${id}/runs/${runId}/results`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id, runId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        Results not found
      </div>
    );
  }

  const { run } = data;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/customers/${id}`)}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Simulation Results
              <RunStatusBadge status={run.status} />
            </h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Run {run.id} · {formatDate(run.startedAt)}
              {run.completedAt && (
                <>
                  {" "}→ {formatDate(run.completedAt)}
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      {(() => {
        // Count unique nodes that actually participated in the balance calculation.
        // This excludes any nodes passed via the 'exclude' config field, since those
        // are omitted from the simulator's balance output entirely.
        const balanceNodeCount =
          data.dcBalance.length > 0
            ? new Set(data.dcBalance.flatMap((dc) => dc.nodes.map((n) => n.host))).size
            : data.hostnameMap.length;
        const balanceNodeLabel =
          data.dcBalance.length > 0 ? "Nodes in simulation" : "Nodes mapped";
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border border rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-tight">{data.tokenMap.length.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Token assignments</div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                <Network className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-tight">{data.dcMap.length}</div>
                <div className="text-xs text-muted-foreground">Data centers</div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-tight">{balanceNodeCount}</div>
                <div className="text-xs text-muted-foreground">{balanceNodeLabel}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-orange-50 text-orange-500 shrink-0">
                <FileDown className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-tight">{data.outputFiles.length}</div>
                <div className="text-xs text-muted-foreground">Output files</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <Tabs defaultValue={data.dcBalance.length > 0 ? "balance" : "terminal"}>
        <TabsList>
          {data.dcBalance.length > 0 && (
            <TabsTrigger value="balance" className="gap-1.5">
              <BarChart2 className="w-3.5 h-3.5" />
              Balance
              <Badge variant="secondary" className="ml-1 text-xs">{data.dcBalance.length}</Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="terminal" className="gap-1.5">
            <Terminal className="w-3.5 h-3.5" />
            Terminal
          </TabsTrigger>
          <TabsTrigger value="tokens" className="gap-1.5">
            <Database className="w-3.5 h-3.5" />
            Token Map
            {data.tokenMap.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{data.tokenMap.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="dc" className="gap-1.5">
            <Network className="w-3.5 h-3.5" />
            DC Map
          </TabsTrigger>
          <TabsTrigger value="hosts" className="gap-1.5">
            <Server className="w-3.5 h-3.5" />
            Hostnames
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5">
            <FileDown className="w-3.5 h-3.5" />
            Files
          </TabsTrigger>
        </TabsList>

        {/* Balance Charts */}
        {data.dcBalance.length > 0 && (
          <TabsContent value="balance" className="mt-4 space-y-6">
            {/* Compact expansion summary */}
            {(() => {
              const totalNodes = data.dcBalance.reduce((s, dc) => s + dc.nodes.length, 0);
              const newNodes = data.dcBalance.reduce((s, dc) => s + dc.nodes.filter((n) => n.isNew).length, 0);
              const allGood = data.dcBalance.every((dc) => dc.isGoodBalance);
              const imbalancedDcs = data.dcBalance.filter((dc) => !dc.isGoodBalance);
              return (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{data.dcBalance.length} data center{data.dcBalance.length !== 1 ? "s" : ""}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-muted-foreground">{totalNodes} nodes total</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="inline-flex items-center gap-1 font-medium text-blue-600">
                      <TrendingUp className="w-3.5 h-3.5" />{newNodes} new
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    {allGood ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Good balance
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-red-600">
                        <XCircle className="w-3.5 h-3.5" /> Imbalanced — review DCs below
                      </span>
                    )}
                  </div>

                  {/* Alert banner when any DC exceeds the 10% deviation threshold */}
                  {imbalancedDcs.length > 0 && (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div className="space-y-1">
                        <p className="font-semibold">Token distribution requires tuning</p>
                        <p className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                          {imbalancedDcs.map((dc) => (
                            <span key={dc.dc} className="block">
                              <span className="font-mono font-medium">{dc.dc}</span>
                              {" — "}max deviation <span className="font-semibold">{dc.maxDeviationPct.toFixed(1)}%</span>
                              {" "}exceeds the 10% threshold
                              {dc.deviatingHostsCount > 0 && ` (${dc.deviatingHostsCount} host${dc.deviatingHostsCount !== 1 ? "s" : ""} affected)`}.
                            </span>
                          ))}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Per-DC charts */}
            {data.dcBalance.map((dc) => (
              <Card key={dc.dc}>
                <CardContent className="pt-6">
                  <DcBalanceChart dc={dc} />
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        )}

        {/* Terminal */}
        <TabsContent value="terminal" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {run.status === "completed" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : run.status === "failed" ? (
                  <XCircle className="w-4 h-4 text-red-500" />
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Process Output
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <pre className="bg-zinc-950 text-zinc-100 font-mono text-xs p-4 rounded-md whitespace-pre-wrap break-all">
                  {run.output || <span className="text-zinc-500">No output captured</span>}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Token Map */}
        <TabsContent value="tokens" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Token Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              {data.tokenMap.length === 0 ? (
                <p className="text-sm text-muted-foreground">No token map data available</p>
              ) : (
                <ScrollArea className="h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-medium">#</TableHead>
                        <TableHead className="font-medium">Token</TableHead>
                        <TableHead className="font-medium">Node IP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.tokenMap.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                          <TableCell className="font-mono text-xs break-all">{row.token}</TableCell>
                          <TableCell className="font-mono text-xs">{row.ip}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DC Map */}
        <TabsContent value="dc" className="mt-4">
          {data.dcMap.length === 0 ? (
            <Card><CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">No DC map data available</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {data.dcMap.map((dc, idx) => {
                const isIp = (s: string) => /^\d+\.\d+\.\d+\.\d+$/.test(s);
                const ips = dc.nodes.filter(isIp);
                const hosts = dc.nodes.filter((n) => !isIp(n));
                const accent = ["border-blue-400","border-violet-400","border-emerald-400","border-orange-400","border-rose-400"][idx % 5];
                const iconBg = ["bg-blue-50 text-blue-600","bg-violet-50 text-violet-600","bg-emerald-50 text-emerald-600","bg-orange-50 text-orange-600","bg-rose-50 text-rose-600"][idx % 5];
                return (
                  <Card key={dc.dc} className={`border-l-4 ${accent}`}>
                    <CardHeader className="pb-3 pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${iconBg}`}>
                            {idx + 1}
                          </div>
                          <div>
                            <span className="font-semibold font-mono text-sm">{dc.dc}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">{dc.nodes.length} node{dc.nodes.length !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {ips.length > 0 && <span>{ips.length} IP{ips.length !== 1 ? "s" : ""}</span>}
                          {hosts.length > 0 && <span>{hosts.length} hostname{hosts.length !== 1 ? "s" : ""}</span>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      {ips.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">IP Addresses</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                            {ips.map((ip, i) => (
                              <code key={i} className="bg-muted/60 border border-border/60 px-2.5 py-1 rounded-md text-xs font-mono truncate">
                                {ip}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}
                      {hosts.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Hostnames</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                            {hosts.map((h, i) => (
                              <code key={i} className="bg-blue-50/60 border border-blue-100 text-blue-800 px-2.5 py-1 rounded-md text-xs font-mono truncate">
                                {h}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Hostname Map */}
        <TabsContent value="hosts" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Hostname Map</CardTitle>
            </CardHeader>
            <CardContent>
              {data.hostnameMap.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hostname map data available</p>
              ) : (
                <ScrollArea className="h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Hostname</TableHead>
                        <TableHead>Rack</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.hostnameMap.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{row.ip}</TableCell>
                          <TableCell className="font-mono text-xs">{row.hostname}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{row.rack}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Output Files */}
        <TabsContent value="files" className="mt-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Output Files</CardTitle>
              {data.outputFiles.length > 0 && (
                <a
                  href={`/api/customers/${id}/runs/${runId}/download-all`}
                  download
                >
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <FolderArchive className="w-3.5 h-3.5" />
                    Download All (.zip)
                  </Button>
                </a>
              )}
            </CardHeader>
            <CardContent>
              {data.outputFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No output files available</p>
              ) : (
                <div className="space-y-2">
                  {data.outputFiles.map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileDown className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-mono">{f.name}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
                        </div>
                      </div>
                      <a
                        href={`/api/customers/${id}/runs/${runId}/download?file=${encodeURIComponent(f.name)}`}
                        download={f.name}
                      >
                        <Button variant="outline" size="sm" className="gap-1">
                          <Download className="w-3 h-3" />
                          Download
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
