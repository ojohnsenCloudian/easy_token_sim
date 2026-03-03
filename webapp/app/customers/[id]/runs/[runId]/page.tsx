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
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[180px]">
      <p className="font-semibold text-sm">{d.host}</p>
      {d.isNew && (
        <span className="inline-block bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-medium">
          New node
        </span>
      )}
      <div className="space-y-0.5 pt-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Raw data ownership</span>
          <span className="font-mono font-medium">{d.rawTB.toFixed(3)} TB</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">vNodes / tokens</span>
          <span className="font-mono">{d.tokens}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Avg per vNode</span>
          <span className="font-mono">{d.avgPerVNode.toFixed(3)} TB</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Deviation</span>
          <span className={`font-mono ${Math.abs(d.deviationPct) > 5 ? "text-amber-600" : "text-green-600"}`}>
            {d.deviationPct > 0 ? "+" : ""}{d.deviationPct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function DcBalanceChart({ dc }: { dc: DcBalance }) {
  const chartData = dc.nodes.map((n) => ({
    ...n,
    label: shortHost(n.host),
    fill: n.isNew ? "#3b82f6" : "#94a3b8",
  }));

  const minTB = Math.min(...dc.nodes.map((n) => n.rawTB));
  const maxTB = Math.max(...dc.nodes.map((n) => n.rawTB));
  const range = maxTB - minTB;
  // Give a little padding around the data
  const yMin = Math.max(0, minTB - range * 2 - 0.5);
  const yMax = maxTB + range * 2 + 0.5;

  const newNodes = dc.nodes.filter((n) => n.isNew).length;
  const existingNodes = dc.nodes.length - newNodes;

  return (
    <div className="space-y-4">
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
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <span>New nodes ({newNodes})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-slate-400" />
          <span>Existing nodes ({existingNodes})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 border-t-2 border-dashed border-orange-400" />
          <span>DC average</span>
        </div>
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            angle={-35}
            textAnchor="end"
            interval={0}
            height={56}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickFormatter={(v: number) => `${v.toFixed(1)}`}
            label={{ value: "Raw TB", angle: -90, position: "insideLeft", fontSize: 10, fill: "#6b7280", dx: -4 }}
          />
          <Tooltip content={<DcBalanceTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <ReferenceLine
            y={dc.nodes.reduce((s, n) => s + n.rawTB, 0) / dc.nodes.length}
            stroke="#f97316"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{ value: "avg", fontSize: 9, fill: "#f97316", position: "right" }}
          />
          <Bar dataKey="rawTB" radius={[3, 3, 0, 0]} maxBarSize={48}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.isNew ? "#3b82f6" : "#94a3b8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

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
              <TableCell className={`font-mono text-xs text-right py-1.5 ${Math.abs(node.deviationPct) > 10 ? "text-red-600 font-semibold" : Math.abs(node.deviationPct) > 5 ? "text-amber-600" : "text-green-600"}`}>
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{data.tokenMap.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Token assignments</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{data.dcMap.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Data centers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{data.hostnameMap.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Nodes mapped</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{data.outputFiles.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Output files</div>
          </CardContent>
        </Card>
      </div>

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
            {/* Overall summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{data.dcBalance.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Data centers</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">
                    {data.dcBalance.reduce((s, dc) => s + dc.nodes.length, 0)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Total nodes after expansion</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {data.dcBalance.reduce((s, dc) => s + dc.nodes.filter((n) => n.isNew).length, 0)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">New nodes added</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className={`text-2xl font-bold ${data.dcBalance.every((dc) => dc.isGoodBalance) ? "text-green-600" : "text-red-600"}`}>
                    {data.dcBalance.every((dc) => dc.isGoodBalance) ? "Good" : "Check"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Overall balance</div>
                </CardContent>
              </Card>
            </div>

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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Data Center Map</CardTitle>
            </CardHeader>
            <CardContent>
              {data.dcMap.length === 0 ? (
                <p className="text-sm text-muted-foreground">No DC map data available</p>
              ) : (
                <div className="space-y-4">
                  {data.dcMap.map((dc) => (
                    <div key={dc.dc} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline" className="font-mono">{dc.dc}</Badge>
                        <span className="text-xs text-muted-foreground">{dc.nodes.length} nodes</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {dc.nodes.map((node, i) => (
                          <code key={i} className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                            {node}
                          </code>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
