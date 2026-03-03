import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { customerDir, FILE_NAMES, FileType } from "@/lib/paths";
import fs from "fs";
import path from "path";
import * as yaml from "js-yaml";

// ─── Validation helpers ───────────────────────────────────────────────────────

const RING_FILENAME = "hsstool-ring.txt";
const STATUS_FILENAME = "hsstool-status.txt";

function fixAndValidateConfig(content: string): {
  content: string;
  fixedPaths: string[];
  warnings: string[];
} {
  const fixedPaths: string[] = [];
  const warnings: string[] = [];

  let doc: Record<string, unknown>;
  try {
    doc = yaml.load(content) as Record<string, unknown>;
  } catch (err) {
    warnings.push(`YAML parse error: ${(err as Error).message}`);
    return { content, fixedPaths, warnings };
  }

  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    warnings.push("YAML is empty or not a key-value mapping");
    return { content, fixedPaths, warnings };
  }

  // ── Auto-fix file paths ───────────────────────────────────────────────────
  let changed = false;

  if (
    typeof doc.hss_ring_output === "string" &&
    doc.hss_ring_output !== RING_FILENAME
  ) {
    doc.hss_ring_output = RING_FILENAME;
    fixedPaths.push("hss_ring_output");
    changed = true;
  }
  if (
    typeof doc.hss_status_output === "string" &&
    doc.hss_status_output !== STATUS_FILENAME
  ) {
    doc.hss_status_output = STATUS_FILENAME;
    fixedPaths.push("hss_status_output");
    changed = true;
  }
  if ("output_dir" in doc) {
    delete doc.output_dir;
    fixedPaths.push("output_dir");
    changed = true;
  }

  // ── Validate required fields ──────────────────────────────────────────────
  for (const key of ["customer_name", "dc_for_nodes", "region", "cumulative"]) {
    if (doc[key] === undefined || doc[key] === null || doc[key] === "") {
      warnings.push(`Missing required field: "${key}"`);
    }
  }

  // ── Validate dc_for_nodes ─────────────────────────────────────────────────
  if (!Array.isArray(doc.dc_for_nodes)) {
    warnings.push('"dc_for_nodes" must be a list — e.g.  - "dc1;5;133;7+5:4"');
  } else if (doc.dc_for_nodes.length === 0) {
    warnings.push('"dc_for_nodes" is empty — add at least one DC entry');
  } else {
    (doc.dc_for_nodes as unknown[]).forEach((entry, i) => {
      const s = String(entry).trim();
      const parts = s.split(";");
      if (parts.length < 4) {
        warnings.push(
          `DC entry ${i + 1} has too few fields: "${s}"` +
            ` — expected format: dcName;numNodes;capacityTB;policy`
        );
      } else if (isNaN(parseInt(parts[1])) || isNaN(parseInt(parts[2]))) {
        warnings.push(
          `DC entry ${i + 1}: numNodes and capacity must be numbers (got "${parts[1]}" and "${parts[2]}")`
        );
      }
    });
  }

  // ── Validate nodes_to_add ─────────────────────────────────────────────────
  if (doc.nodes_to_add !== undefined) {
    if (!Array.isArray(doc.nodes_to_add)) {
      warnings.push('"nodes_to_add" must be a list');
    } else {
      (doc.nodes_to_add as unknown[]).forEach((entry, i) => {
        const s = String(entry).trim();
        const parts = s.split(":");
        if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
          warnings.push(
            `nodes_to_add entry ${i + 1} has invalid format: "${s}"` +
              ` — expected: hostname:dc:rack`
          );
        }
      });
    }
  }

  const resultContent = changed
    ? "---\n" + yaml.dump(doc, { lineWidth: 120, quotingType: '"' })
    : content;

  return { content: resultContent, fixedPaths, warnings };
}

function validateRingFile(content: string): string[] {
  const warnings: string[] = [];
  const lines = content.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length === 0) return ["File is empty"];

  if (lines.length < 5) {
    warnings.push(
      `File only has ${lines.length} lines — expected more for hsstool ring output`
    );
  }
  if (!/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(content)) {
    warnings.push(
      "No IP addresses found — check this is the hsstool ring output from a cluster node"
    );
  }
  if (!/[Tt]oken/.test(content)) {
    warnings.push(
      '"Token" keyword not found — check this is the hsstool ring output (run: hsstool -h <node-ip> ring)'
    );
  }
  return warnings;
}

function validateStatusFile(content: string): string[] {
  const warnings: string[] = [];
  const lines = content.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length === 0) return ["File is empty"];

  if (lines.length < 3) {
    warnings.push(
      `File only has ${lines.length} lines — expected more for hsstool status output`
    );
  }
  if (!/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(content)) {
    warnings.push(
      "No IP addresses found — check this is the hsstool status output from a cluster node"
    );
  }
  const hasStatusCodes =
    /\b(UN|DN|UL|DL)\b/.test(content) || /\b(Up|Down)\b/i.test(content);
  if (!hasStatusCodes) {
    warnings.push(
      'No node status codes found (UN/DN/UL/DL) — check this is the hsstool status output (run: hsstool -h <node-ip> status)'
    );
  }
  return warnings;
}

// ─── Route handlers ───────────────────────────────────────────────────────────

async function resolveCustomer(id: string) {
  return prisma.customer.findUnique({ where: { id } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const { id, type } = await params;
  const fileType = type as FileType;
  if (!FILE_NAMES[fileType]) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  const customer = await resolveCustomer(id);
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(customerDir(customer.folderName), FILE_NAMES[fileType]);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return NextResponse.json({ content });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const { id, type } = await params;
  const fileType = type as FileType;
  if (!FILE_NAMES[fileType]) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  const customer = await resolveCustomer(id);
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { content: rawContent } = await req.json();
  if (typeof rawContent !== "string") {
    return NextResponse.json({ error: "Content must be a string" }, { status: 400 });
  }

  let content = rawContent;
  let fixedPaths: string[] = [];
  let warnings: string[] = [];

  if (fileType === "config") {
    const result = fixAndValidateConfig(rawContent);
    content = result.content;
    fixedPaths = result.fixedPaths;
    warnings = result.warnings;
  } else if (fileType === "ring") {
    warnings = validateRingFile(rawContent);
  } else if (fileType === "status") {
    warnings = validateStatusFile(rawContent);
  }

  const filePath = path.join(customerDir(customer.folderName), FILE_NAMES[fileType]);
  fs.writeFileSync(filePath, content, "utf-8");
  return NextResponse.json({ ok: true, fixedPaths, warnings });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const { id, type } = await params;
  const fileType = type as FileType;
  if (!FILE_NAMES[fileType]) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  const customer = await resolveCustomer(id);
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const rawContent = await file.text();
  let content = rawContent;
  let fixedPaths: string[] = [];
  let warnings: string[] = [];

  if (fileType === "config") {
    const result = fixAndValidateConfig(rawContent);
    content = result.content;
    fixedPaths = result.fixedPaths;
    warnings = result.warnings;
  } else if (fileType === "ring") {
    warnings = validateRingFile(rawContent);
  } else if (fileType === "status") {
    warnings = validateStatusFile(rawContent);
  }

  const filePath = path.join(customerDir(customer.folderName), FILE_NAMES[fileType]);
  fs.writeFileSync(filePath, content, "utf-8");
  return NextResponse.json({ ok: true, fixedPaths, warnings });
}
