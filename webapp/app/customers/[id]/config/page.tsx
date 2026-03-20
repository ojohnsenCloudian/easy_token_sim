"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ConfigFormData,
  DcEntry,
  Policy,
  RackEntry,
  NodeToAdd,
  formToYaml,
  yamlToForm,
  emptyConfig,
  getDcNames,
} from "@/lib/config-yaml";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  AlertTriangle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// ─── Reusable field helpers ────────────────────────────────────────────────────

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {hint && (
          <span className="ml-1.5 text-muted-foreground font-normal text-xs">({hint})</span>
        )}
      </Label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min = 0,
  placeholder,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  placeholder?: string;
}) {
  return (
    <Input
      type="number"
      min={min}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value === "" ? undefined : parseInt(e.target.value);
        onChange(isNaN(v as number) ? undefined : v);
      }}
      className="h-9 text-sm"
    />
  );
}

// ─── Policy editor ─────────────────────────────────────────────────────────────

function policyPreview(p: Policy): string {
  if (p.type === "rf") {
    return p.replicasInDc != null
      ? `RF${p.rf}, ${p.replicasInDc} replica(s) in DC`
      : `RF${p.rf}, all replicas in DC`;
  }
  if (p.type === "ec") {
    const all = (p.k ?? 0) + (p.m ?? 0);
    const frags = p.fragsInDc ?? all;
    return `EC ${p.k}+${p.m}, ${frags} of ${all} fragments in DC`;
  }
  const all = (p.k ?? 0) + (p.m ?? 0);
  return `Hybrid EC ${p.k}+${p.m} (${p.fragsInDc}/${all} frags) + ${p.rfReplicas} replica(s) in DC`;
}

function PolicyEditor({
  policy,
  onChange,
  onRemove,
}: {
  policy: Policy;
  onChange: (p: Policy) => void;
  onRemove: () => void;
}) {
  const setType = (t: string) => {
    if (t === "rf") onChange({ type: "rf", rf: 3 });
    else if (t === "ec") onChange({ type: "ec", k: 4, m: 2 });
    else onChange({ type: "hybrid", k: 4, m: 2, fragsInDc: 4, rfReplicas: 1 });
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <Select value={policy.type} onValueChange={setType}>
          <SelectTrigger className="h-9 text-sm w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rf">RF (Replica)</SelectItem>
            <SelectItem value="ec">EC (Erasure Coding)</SelectItem>
            <SelectItem value="hybrid">Hybrid EC + RF</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1 text-xs text-muted-foreground font-mono bg-muted px-2 py-1.5 rounded truncate">
          {policyPreview(policy)}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {policy.type === "rf" && (
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Replication Factor">
            <NumberInput
              value={policy.rf}
              min={1}
              onChange={(v) => onChange({ ...policy, rf: v ?? 3 })}
            />
          </FieldRow>
          <FieldRow label="Replicas in this DC" hint="blank = all">
            <NumberInput
              value={policy.replicasInDc}
              min={1}
              placeholder="all"
              onChange={(v) => onChange({ ...policy, replicasInDc: v })}
            />
          </FieldRow>
        </div>
      )}

      {policy.type === "ec" && (
        <div className="grid grid-cols-3 gap-3">
          <FieldRow label="K (data shards)">
            <NumberInput
              value={policy.k}
              min={1}
              onChange={(v) => onChange({ ...policy, k: v ?? 4 })}
            />
          </FieldRow>
          <FieldRow label="M (parity shards)">
            <NumberInput
              value={policy.m}
              min={1}
              onChange={(v) => onChange({ ...policy, m: v ?? 2 })}
            />
          </FieldRow>
          <FieldRow label="Fragments in this DC" hint={`blank = all (${(policy.k ?? 0) + (policy.m ?? 0)})`}>
            <NumberInput
              value={policy.fragsInDc}
              min={1}
              placeholder="all"
              onChange={(v) => onChange({ ...policy, fragsInDc: v })}
            />
          </FieldRow>
        </div>
      )}

      {policy.type === "hybrid" && (
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="K (data shards)">
            <NumberInput
              value={policy.k}
              min={1}
              onChange={(v) => onChange({ ...policy, k: v ?? 4 })}
            />
          </FieldRow>
          <FieldRow label="M (parity shards)">
            <NumberInput
              value={policy.m}
              min={1}
              onChange={(v) => onChange({ ...policy, m: v ?? 2 })}
            />
          </FieldRow>
          <FieldRow label="Fragments in DC">
            <NumberInput
              value={policy.fragsInDc}
              min={1}
              onChange={(v) => onChange({ ...policy, fragsInDc: v ?? 4 })}
            />
          </FieldRow>
          <FieldRow label="RF Replicas in DC">
            <NumberInput
              value={policy.rfReplicas}
              min={1}
              onChange={(v) => onChange({ ...policy, rfReplicas: v ?? 1 })}
            />
          </FieldRow>
        </div>
      )}
    </div>
  );
}

// ─── DC entry editor ───────────────────────────────────────────────────────────

function DcEntryEditor({
  dc,
  index,
  onChange,
  onRemove,
}: {
  dc: DcEntry;
  index: number;
  onChange: (dc: DcEntry) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const updatePolicy = (i: number, p: Policy) => {
    const policies = [...dc.policies];
    policies[i] = p;
    onChange({ ...dc, policies });
  };
  const addPolicy = () =>
    onChange({ ...dc, policies: [...dc.policies, { type: "rf", rf: 3 }] });

  const updateRack = (i: number, r: RackEntry) => {
    const racks = [...dc.racks];
    racks[i] = r;
    onChange({ ...dc, racks });
  };
  const addRack = () =>
    onChange({ ...dc, racks: [...dc.racks, { name: "", count: 1 }] });

  const totalRackNodes = dc.racks.reduce((s, r) => s + (r.count || 0), 0);
  const rackMismatch = dc.racks.length > 0 && totalRackNodes !== dc.numNodes;

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none bg-muted/20 hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-xs shrink-0">
            DC {index + 1}
          </Badge>
          <span className="font-semibold text-sm">
            {dc.dcName || <span className="text-muted-foreground italic font-normal">unnamed</span>}
          </span>
          {dc.numNodes > 0 && (
            <span className="text-xs text-muted-foreground">
              {dc.numNodes} node{dc.numNodes !== 1 ? "s" : ""} · {dc.nodeCapacityTb} TB each
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <CardContent className="pt-5 space-y-6">
          {/* Basic fields */}
          <div className="grid grid-cols-3 gap-4">
            <FieldRow label="DC Name">
              <Input
                value={dc.dcName}
                className="h-9 text-sm"
                placeholder="e.g. dc01"
                onChange={(e) => onChange({ ...dc, dcName: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Nodes to Add">
              <NumberInput
                value={dc.numNodes}
                min={0}
                onChange={(v) => onChange({ ...dc, numNodes: v ?? 0 })}
              />
            </FieldRow>
            <FieldRow label="Node Capacity (TB)">
              <NumberInput
                value={dc.nodeCapacityTb}
                min={1}
                onChange={(v) => onChange({ ...dc, nodeCapacityTb: v ?? 1 })}
              />
            </FieldRow>
          </div>

          {/* Policies */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Storage Policies</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  RF for replica, EC for erasure coding, or both for hybrid
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-1" onClick={addPolicy}>
                <Plus className="w-3.5 h-3.5" /> Add Policy
              </Button>
            </div>
            {dc.policies.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                No policies — add at least one.
              </p>
            )}
            <div className="space-y-2">
              {dc.policies.map((p, i) => (
                <PolicyEditor
                  key={i}
                  policy={p}
                  onChange={(np) => updatePolicy(i, np)}
                  onRemove={() => {
                    onChange({ ...dc, policies: dc.policies.filter((_, idx) => idx !== i) });
                  }}
                />
              ))}
            </div>
          </div>

          {/* Rack config */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Rack Configuration</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Optional — only needed for multi-rack DCs
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-1" onClick={addRack}>
                <Plus className="w-3.5 h-3.5" /> Add Rack
              </Button>
            </div>
            {dc.racks.length > 0 && (
              <div className="space-y-2">
                {dc.racks.map((r, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Input
                      value={r.name}
                      className="h-9 text-sm"
                      placeholder="Rack name (e.g. rack1)"
                      onChange={(e) => updateRack(i, { ...r, name: e.target.value })}
                    />
                    <span className="text-muted-foreground text-xs shrink-0">nodes:</span>
                    <div className="w-28 shrink-0">
                      <NumberInput
                        value={r.count}
                        min={1}
                        onChange={(v) => updateRack(i, { ...r, count: v ?? 1 })}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        onChange({ ...dc, racks: dc.racks.filter((_, idx) => idx !== i) })
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {rackMismatch && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Rack total ({totalRackNodes}) doesn&apos;t match nodes to add ({dc.numNodes})
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ConfigEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [tab, setTab] = useState<"form" | "yaml">("form");
  const [form, setForm] = useState<ConfigFormData | null>(null);
  const [rawYaml, setRawYaml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [fixedPaths, setFixedPaths] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      // Load customer name for the breadcrumb
      const custRes = await fetch(`/api/customers/${id}`);
      if (!custRes.ok) { router.push("/"); return; }
      const cust = await custRes.json();
      setCustomerName(cust.name);

      // Load config file if it exists
      const fileRes = await fetch(`/api/customers/${id}/files/config`);
      if (fileRes.ok) {
        const data = await fileRes.json();
        const content = data.content as string;
        setRawYaml(content);
        const parsed = yamlToForm(content);
        setForm(parsed ?? emptyConfig(cust.name));
      } else {
        setForm(emptyConfig(cust.name));
        setRawYaml("");
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // Sync between tabs
  const handleTabChange = (t: string) => {
    if (t === "yaml" && form) setRawYaml(formToYaml(form));
    if (t === "form" && rawYaml) {
      const parsed = yamlToForm(rawYaml);
      if (parsed) setForm(parsed);
    }
    setTab(t as "form" | "yaml");
  };

  async function save() {
    const content = tab === "form" && form ? formToYaml(form) : rawYaml;
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${id}/files/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) { toast.error("Save failed"); return; }
      const result = await res.json();

      // Show what was auto-fixed
      const fixed: string[] = result.fixedPaths ?? [];
      const warn: string[] = result.warnings ?? [];
      setFixedPaths(fixed);
      setWarnings(warn);

      if (warn.length > 0) {
        toast.warning("Saved with warnings", {
          description: "Check the warnings panel before running the simulation.",
        });
      } else if (fixed.length > 0) {
        toast.success("Config saved — paths auto-corrected");
      } else {
        toast.success("Config saved");
      }

      // Reload to show server-corrected content
      const updated = await fetch(`/api/customers/${id}/files/config`);
      if (updated.ok) {
        const data = await updated.json();
        setRawYaml(data.content);
        const parsed = yamlToForm(data.content);
        if (parsed) setForm(parsed);
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveAndBack() {
    await save();
    router.push(`/customers/${id}`);
  }

  // DC helpers
  const addDc = () => {
    if (!form) return;
    setForm({
      ...form,
      dcEntries: [
        ...form.dcEntries,
        { dcName: "", numNodes: 1, nodeCapacityTb: 100, policies: [{ type: "rf", rf: 3 }], racks: [] },
      ],
    });
  };
  const updateDc = (i: number, dc: DcEntry) => {
    if (!form) return;
    const dcEntries = [...form.dcEntries];
    dcEntries[i] = dc;
    setForm({ ...form, dcEntries });
  };
  const removeDc = (i: number) => {
    if (!form) return;
    setForm({ ...form, dcEntries: form.dcEntries.filter((_, idx) => idx !== i) });
  };

  // Exclude helpers
  const addExcluded = () => {
    if (!form) return;
    setForm({ ...form, excludedNodes: [...form.excludedNodes, ""] });
  };
  const updateExcluded = (i: number, value: string) => {
    if (!form) return;
    const excludedNodes = [...form.excludedNodes];
    excludedNodes[i] = value;
    setForm({ ...form, excludedNodes });
  };
  const removeExcluded = (i: number) => {
    if (!form) return;
    setForm({ ...form, excludedNodes: form.excludedNodes.filter((_, idx) => idx !== i) });
  };

  // Node helpers
  const addNode = () => {
    if (!form) return;
    setForm({
      ...form,
      nodesToAdd: [
        ...form.nodesToAdd,
        {
          hostname: "",
          dc: form.dcEntries[0]?.dcName ?? "",
          rack: form.dcEntries[0]?.racks[0]?.name ?? "rack1",
        },
      ],
    });
  };
  const updateNode = (i: number, n: NodeToAdd) => {
    if (!form) return;
    const nodesToAdd = [...form.nodesToAdd];
    nodesToAdd[i] = n;
    setForm({ ...form, nodesToAdd });
  };
  const autoFillNodes = () => {
    if (!form) return;
    const nodes: NodeToAdd[] = [];
    form.dcEntries.forEach((dc) => {
      if (dc.numNodes <= 0) return;
      if (dc.racks.length > 0) {
        dc.racks.forEach((rack) => {
          for (let i = 0; i < rack.count; i++)
            nodes.push({ hostname: "", dc: dc.dcName, rack: rack.name });
        });
      } else {
        for (let i = 0; i < dc.numNodes; i++)
          nodes.push({ hostname: "", dc: dc.dcName, rack: "rack1" });
      }
    });
    setForm({ ...form, nodesToAdd: nodes });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Sticky header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background border-b mb-6 -mx-4 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/customers/${id}`)}
              className="shrink-0"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Separator orientation="vertical" className="h-5 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground truncate">{customerName}</span>
                <span className="text-muted-foreground/50">/</span>
                <span className="font-semibold text-sm">Config Editor</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate">
                customer_info.yaml
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/customers/${id}`)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" onClick={saveAndBack} disabled={saving} className="gap-1.5">
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save & Back
            </Button>
          </div>
        </div>
      </div>

      {/* ── Validation banners ────────────────────────────────────────────────── */}
      {fixedPaths.length > 0 && (
        <div className="mb-4 flex items-start gap-2 border border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700 rounded-lg px-4 py-3">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              Paths auto-corrected on save
            </p>
            <ul className="mt-1 space-y-0.5">
              {fixedPaths.map((p, i) => {
                const labels: Record<string, string> = {
                  hss_ring_output: "hss_ring_output → hsstool-ring.txt",
                  hss_status_output: "hss_status_output → hsstool-status.txt",
                  output_dir: "output_dir removed (managed automatically)",
                };
                return (
                  <li key={i} className="text-xs text-blue-700 dark:text-blue-400 font-mono">
                    {labels[p] ?? p}
                  </li>
                );
              })}
            </ul>
          </div>
          <button
            className="ml-auto text-blue-400 hover:text-blue-600 text-xs"
            onClick={() => setFixedPaths([])}
          >
            ✕
          </button>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mb-4 flex items-start gap-2 border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Validation warnings
            </p>
            <ul className="mt-1 space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-700 dark:text-amber-400">• {w}</li>
              ))}
            </ul>
          </div>
          <button
            className="ml-auto text-amber-400 hover:text-amber-600 text-xs"
            onClick={() => setWarnings([])}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="form">Form Editor</TabsTrigger>
          <TabsTrigger value="yaml">Raw YAML</TabsTrigger>
        </TabsList>

        {/* ── Form editor tab ─────────────────────────────────────────────────── */}
        <TabsContent value="form" className="space-y-8">
          {form && (
            <>
              {/* Basic settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Basic Settings</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-5">
                  <FieldRow label="Customer Name">
                    <Input
                      value={form.customerName}
                      className="h-9 text-sm"
                      onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    />
                  </FieldRow>
                  <FieldRow label="Region">
                    <Input
                      value={form.region}
                      className="h-9 text-sm"
                      placeholder="e.g. us_east"
                      onChange={(e) => setForm({ ...form, region: e.target.value })}
                    />
                  </FieldRow>
                  <FieldRow label="Preferred Token Number" hint="0 = auto-calculate">
                    <NumberInput
                      value={form.preferredTokenNumber}
                      min={0}
                      placeholder="auto"
                      onChange={(v) => setForm({ ...form, preferredTokenNumber: v })}
                    />
                  </FieldRow>
                  <FieldRow label="Cumulative Token Mode">
                    <div className="flex items-center gap-3 h-9">
                      <Switch
                        checked={form.cumulative}
                        onCheckedChange={(v) => setForm({ ...form, cumulative: v })}
                      />
                      <span className="text-sm text-muted-foreground">
                        {form.cumulative ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </FieldRow>
                </CardContent>
              </Card>

              <Separator />

              {/* DC configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold">
                      Data Center Configuration
                      <span className="ml-2 text-muted-foreground font-normal text-sm">
                        {form.dcEntries.length} DC{form.dcEntries.length !== 1 ? "s" : ""}
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Define each DC to expand — nodes, capacity, and storage policies
                    </p>
                  </div>
                  <Button variant="outline" className="gap-1.5" onClick={addDc}>
                    <Plus className="w-4 h-4" /> Add DC
                  </Button>
                </div>
                {form.dcEntries.length === 0 && (
                  <p className="text-sm text-muted-foreground italic py-4 text-center border rounded-lg">
                    No DCs configured yet. Add one to get started.
                  </p>
                )}
                <div className="space-y-3">
                  {form.dcEntries.map((dc, i) => (
                    <DcEntryEditor
                      key={i}
                      dc={dc}
                      index={i}
                      onChange={(d) => updateDc(i, d)}
                      onRemove={() => removeDc(i)}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              {/* New node hostnames */}
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold">
                      New Node Hostnames
                      <span className="ml-2 text-muted-foreground font-normal text-sm">
                        optional
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                      Map real hostnames to DCs and racks. Used for output reports — the
                      simulator assigns pseudo-IPs if omitted.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {form.dcEntries.some((dc) => dc.numNodes > 0) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={autoFillNodes}
                        title="Pre-fill rows based on DC node counts"
                      >
                        Auto-fill rows
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="gap-1" onClick={addNode}>
                      <Plus className="w-3.5 h-3.5" /> Add Node
                    </Button>
                  </div>
                </div>

                {form.nodesToAdd.length > 0 && (
                  <Card>
                    <div className="grid grid-cols-[1fr_1fr_1fr_2.5rem] gap-0 bg-muted/40 px-4 py-2.5 text-xs font-semibold text-muted-foreground border-b">
                      <span>Hostname</span>
                      <span>DC</span>
                      <span>Rack</span>
                      <span />
                    </div>
                    <div className="divide-y">
                      {form.nodesToAdd.map((node, i) => {
                        const dcNames = getDcNames(form);
                        const racksForDc =
                          form.dcEntries.find((dc) => dc.dcName === node.dc)?.racks ?? [];
                        return (
                          <div
                            key={i}
                            className="grid grid-cols-[1fr_1fr_1fr_2.5rem] gap-3 items-center px-4 py-2.5"
                          >
                            <Input
                              value={node.hostname}
                              className="h-8 text-xs font-mono"
                              placeholder="e.g. cloudian-node1"
                              onChange={(e) => updateNode(i, { ...node, hostname: e.target.value })}
                            />
                            <Select
                              value={node.dc}
                              onValueChange={(v) => {
                                const newRacks =
                                  form.dcEntries.find((dc) => dc.dcName === v)?.racks ?? [];
                                updateNode(i, {
                                  ...node,
                                  dc: v,
                                  rack: newRacks[0]?.name ?? node.rack,
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select DC" />
                              </SelectTrigger>
                              <SelectContent>
                                {dcNames.length > 0 ? (
                                  dcNames.map((dc) => (
                                    <SelectItem key={dc} value={dc} className="text-xs">
                                      {dc}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value={node.dc || "_"} className="text-xs">
                                    {node.dc || "(no DCs defined)"}
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                            {racksForDc.length > 1 ? (
                              <Select
                                value={node.rack}
                                onValueChange={(v) => updateNode(i, { ...node, rack: v })}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Rack" />
                                </SelectTrigger>
                                <SelectContent>
                                  {racksForDc.map((r) => (
                                    <SelectItem key={r.name} value={r.name} className="text-xs">
                                      {r.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={node.rack}
                                className="h-8 text-xs font-mono"
                                placeholder="rack1"
                                onChange={(e) => updateNode(i, { ...node, rack: e.target.value })}
                              />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                setForm({
                                  ...form,
                                  nodesToAdd: form.nodesToAdd.filter((_, idx) => idx !== i),
                                })
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
                {form.nodesToAdd.length === 0 && (
                  <p className="text-sm text-muted-foreground italic py-4 text-center border rounded-lg">
                    No hostnames configured — the simulator will use auto-generated IPs.
                  </p>
                )}
              </div>

              <Separator />

              {/* Excluded nodes */}
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold">
                      Exclude Nodes from Balance Calculation
                      <span className="ml-2 text-muted-foreground font-normal text-sm">
                        optional
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                      IPs or hostnames of existing nodes to exclude when computing balance
                      statistics. Useful for nodes being decommissioned or known outliers.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={addExcluded}>
                    <Plus className="w-3.5 h-3.5" /> Add Node
                  </Button>
                </div>

                {form.excludedNodes.length > 0 && (
                  <Card>
                    <div className="divide-y">
                      {form.excludedNodes.map((node, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                          <Input
                            value={node}
                            className="h-8 text-xs font-mono"
                            placeholder="e.g. 192.168.1.10 or cloudian-node05"
                            onChange={(e) => updateExcluded(i, e.target.value)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeExcluded(i)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                {form.excludedNodes.length === 0 && (
                  <p className="text-sm text-muted-foreground italic py-4 text-center border rounded-lg">
                    No nodes excluded — all existing nodes are included in balance calculations.
                  </p>
                )}
              </div>

              <Separator />

              {/* YAML preview */}
              <div className="space-y-3">
                <h3 className="text-base font-semibold">Generated YAML Preview</h3>
                <pre className="bg-muted rounded-lg p-4 text-xs font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed border">
                  {formToYaml(form)}
                </pre>
              </div>

              {/* Bottom save buttons */}
              <div className="flex justify-end gap-3 pt-2 pb-8">
                <Button variant="outline" onClick={() => router.push(`/customers/${id}`)}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving} variant="outline" className="gap-1.5">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </Button>
                <Button onClick={saveAndBack} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save & Back
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── YAML tab ────────────────────────────────────────────────────────── */}
        <TabsContent value="yaml" className="space-y-4">
          <div className="border rounded-lg overflow-hidden" style={{ height: "calc(100vh - 280px)" }}>
            <MonacoEditor
              height="100%"
              language="yaml"
              value={rawYaml}
              onChange={(v) => setRawYaml(v ?? "")}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>
          <div className="flex justify-end gap-3 pb-8">
            <Button variant="outline" onClick={() => router.push(`/customers/${id}`)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} variant="outline" className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </Button>
            <Button onClick={saveAndBack} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save & Back
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
