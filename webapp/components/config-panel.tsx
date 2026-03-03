"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  Upload,
  LayoutList,
  Pencil,
  Loader2,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface ConfigPanelProps {
  customerId: string;
  exists: boolean;
  onUpdate: () => void;
}

interface ValidationState {
  fixedPaths: string[];
  warnings: string[];
}

export function ConfigPanel({ customerId, exists, onUpdate }: ConfigPanelProps) {
  // customerName is fetched by the /config page itself
  const router = useRouter();
  const [yamlOpen, setYamlOpen] = useState(false);
  const [yamlContent, setYamlContent] = useState("");
  const [yamlLoading, setYamlLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [validation, setValidation] = useState<ValidationState>({ fixedPaths: [], warnings: [] });
  const fileRef = useRef<HTMLInputElement>(null);

  function handleValidationResponse(result: { fixedPaths?: string[]; warnings?: string[] }) {
    const fixedPaths = result.fixedPaths ?? [];
    const warnings = result.warnings ?? [];
    setValidation({ fixedPaths, warnings });

    if (fixedPaths.length > 0 && warnings.length === 0) {
      toast.success("Config uploaded — paths auto-corrected", {
        description: buildFixDescription(fixedPaths),
        duration: 6000,
      });
    } else if (fixedPaths.length > 0 && warnings.length > 0) {
      toast.warning("Config uploaded — paths auto-corrected, but has warnings", {
        description: buildFixDescription(fixedPaths) + "\nSee warning panel for details.",
        duration: 8000,
      });
    } else if (warnings.length > 0) {
      toast.warning(`Config uploaded with ${warnings.length} warning${warnings.length > 1 ? "s" : ""}`, {
        description: "See the warning panel below for details.",
        duration: 6000,
      });
    } else {
      toast.success("Config uploaded");
    }
  }

  function buildFixDescription(fixedPaths: string[]): string {
    const labels: Record<string, string> = {
      hss_ring_output: "hss_ring_output → hsstool-ring.txt",
      hss_status_output: "hss_status_output → hsstool-status.txt",
      output_dir: "output_dir removed (managed automatically)",
    };
    return fixedPaths.map((p) => labels[p] ?? p).join("\n");
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setValidation({ fixedPaths: [], warnings: [] });
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/customers/${customerId}/files/config`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Upload failed");
        return;
      }
      const result = await res.json();
      handleValidationResponse(result);
      onUpdate();
    } finally {
      setUploading(false);
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function openYamlEditor() {
    setYamlLoading(true);
    setYamlOpen(true);
    try {
      if (exists) {
        const res = await fetch(`/api/customers/${customerId}/files/config`);
        if (res.ok) {
          const data = await res.json();
          setYamlContent(data.content ?? "");
          return;
        }
      }
      setYamlContent("");
    } finally {
      setYamlLoading(false);
    }
  }

  async function saveYaml() {
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/files/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: yamlContent }),
      });
      if (!res.ok) { toast.error("Save failed"); return; }
      const result = await res.json();
      handleValidationResponse(result);
      if ((result.fixedPaths ?? []).length > 0) {
        const updated = await fetch(`/api/customers/${customerId}/files/config`);
        if (updated.ok) {
          const data = await updated.json();
          setYamlContent(data.content ?? "");
        }
      }
      setYamlOpen(false);
      onUpdate();
    } finally {
      setSaving(false);
    }
  }

  const hasIssues = validation.fixedPaths.length > 0 || validation.warnings.length > 0;

  return (
    <>
      <div className="flex flex-col gap-0">
        <Card
          className={`relative transition-colors ${hasIssues ? "rounded-b-none border-b-0" : ""} ${isDragging ? "border-primary bg-primary/5" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {exists ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                Config (YAML)
              </CardTitle>
              <Badge variant={exists ? "default" : "outline"} className="text-xs">
                {exists ? "Uploaded" : "Missing"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              customer_info.yaml — DC, policy, and node configuration
            </p>
          </CardHeader>

          <CardContent className="space-y-2">
            <div
              className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  <Upload className="w-5 h-5 mx-auto mb-1 opacity-50" />
                  Drop file here or click to upload
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
                e.target.value = "";
              }}
            />

            {/* Navigate to full-page form editor */}
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={() => router.push(`/customers/${customerId}/config`)}
            >
              <LayoutList className="w-3.5 h-3.5" />
              {exists ? "Edit" : "Create"} with Form Editor
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={openYamlEditor}
            >
              <Pencil className="w-3 h-3" />
              Edit as Raw YAML
            </Button>
          </CardContent>
        </Card>

        {/* Inline path-fix info */}
        {validation.fixedPaths.length > 0 && (
          <div className={`border border-t-0 border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700 px-3 py-2.5 ${validation.warnings.length > 0 ? "" : "rounded-b-lg"}`}>
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">
                  Paths auto-corrected
                </p>
                <ul className="space-y-0.5">
                  {validation.fixedPaths.map((p, i) => {
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
                className="text-blue-400 hover:text-blue-600 shrink-0"
                onClick={() => setValidation((v) => ({ ...v, fixedPaths: [] }))}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Inline validation warnings */}
        {validation.warnings.length > 0 && (
          <div className="border border-t-0 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 rounded-b-lg px-3 py-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  Validation warnings
                </p>
                <ul className="space-y-0.5">
                  {validation.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-700 dark:text-amber-400">
                      • {w}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                className="text-amber-500 hover:text-amber-700 shrink-0"
                onClick={() => setValidation((v) => ({ ...v, warnings: [] }))}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Raw YAML editor dialog (quick edit without leaving the page) */}
      <Dialog open={yamlOpen} onOpenChange={setYamlOpen}>
        <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>Edit Raw YAML — customer_info.yaml</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {yamlLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <MonacoEditor
                height="100%"
                language="yaml"
                value={yamlContent}
                onChange={(v) => setYamlContent(v ?? "")}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                }}
              />
            )}
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setYamlOpen(false)}>Cancel</Button>
            <Button onClick={saveYaml} disabled={saving}>
              {saving ? <><Loader2 className="w-3 h-3 mr-2 animate-spin" />Saving...</> : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
