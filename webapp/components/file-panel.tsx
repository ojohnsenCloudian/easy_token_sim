"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Upload, Pencil, Loader2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface FilePanelProps {
  customerId: string;
  fileType: "ring" | "status" | "config";
  label: string;
  description: string;
  exists: boolean;
  language?: string;
  onUpdate: () => void;
}

export function FilePanel({
  customerId,
  fileType,
  label,
  description,
  exists,
  language = "plaintext",
  onUpdate,
}: FilePanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorContent, setEditorContent] = useState<string>("");
  const [editorLoading, setEditorLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleValidationResponse(result: { warnings?: string[] }) {
    const w = result.warnings ?? [];
    setWarnings(w);
    if (w.length > 0) {
      toast.warning(`${label} uploaded with ${w.length} warning${w.length > 1 ? "s" : ""}`, {
        description: "See the warning panel below the file card for details.",
        duration: 6000,
      });
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setWarnings([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/customers/${customerId}/files/${fileType}`, {
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
      if ((result.warnings ?? []).length === 0) {
        toast.success(`${label} uploaded`);
      }
      onUpdate();
    } finally {
      setUploading(false);
    }
  }

  async function openEditor() {
    setEditorLoading(true);
    setEditorOpen(true);
    try {
      if (exists) {
        const res = await fetch(`/api/customers/${customerId}/files/${fileType}`);
        if (res.ok) {
          const data = await res.json();
          setEditorContent(data.content ?? "");
        }
      } else {
        setEditorContent("");
      }
    } finally {
      setEditorLoading(false);
    }
  }

  async function saveEditor() {
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/files/${fileType}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editorContent }),
      });
      if (!res.ok) {
        toast.error("Save failed");
        return;
      }
      const result = await res.json();
      handleValidationResponse(result);
      if ((result.warnings ?? []).length === 0) {
        toast.success(`${label} saved`);
      }
      setEditorOpen(false);
      onUpdate();
    } finally {
      setSaving(false);
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customerId, fileType]
  );

  return (
    <>
      <div className="flex flex-col gap-0">
        <Card
          className={`relative transition-colors rounded-b-none border-b-0 ${isDragging ? "border-primary bg-primary/5" : ""}`}
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
                {label}
              </CardTitle>
              <Badge variant={exists ? "default" : "outline"} className="text-xs">
                {exists ? "Uploaded" : "Missing"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
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
            <Button variant="outline" size="sm" className="w-full" onClick={openEditor}>
              <Pencil className="w-3 h-3 mr-2" />
              {exists ? "Edit" : "Create"} in editor
            </Button>
          </CardContent>
        </Card>

        {/* Inline validation warnings */}
        {warnings.length > 0 && (
          <div className="border border-t-0 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 rounded-b-lg px-3 py-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  Validation warnings
                </p>
                <ul className="space-y-0.5">
                  {warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-700 dark:text-amber-400">
                      • {w}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                className="text-amber-500 hover:text-amber-700 shrink-0"
                onClick={() => setWarnings([])}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>
              {exists ? "Edit" : "Create"} — {label}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {editorLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <MonacoEditor
                height="100%"
                language={language}
                value={editorContent}
                onChange={(v) => setEditorContent(v ?? "")}
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
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEditor} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
