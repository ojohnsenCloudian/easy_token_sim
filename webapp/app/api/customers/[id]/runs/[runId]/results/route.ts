import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { DcBalance, NodeBalance } from "@/lib/types";
import fs from "fs";
import path from "path";

function parseKeyValueFile(content: string): Array<{ key: string; value: string }> {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("="))
    .map((line) => {
      const idx = line.indexOf("=");
      return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    });
}

function parseTokenMap(content: string): Array<{ token: string; ip: string }> {
  return content
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => line.includes("="))
    .map((line) => {
      const [token, ip] = line.split("=");
      return { token: token?.trim() ?? "", ip: ip?.trim() ?? "" };
    });
}

function parseDcMap(content: string): Array<{ dc: string; nodes: string[] }> {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("="))
    .map((line) => {
      const [dc, nodesStr] = line.split("=");
      return {
        dc: dc?.trim() ?? "",
        nodes: nodesStr?.split(",").map((n) => n.trim()).filter(Boolean) ?? [],
      };
    });
}

function parseHostnameMap(
  content: string
): Array<{ ip: string; hostname: string; rack: string }> {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("="))
    .map((line) => {
      const [ip, rest] = line.split("=");
      const parts = (rest ?? "").split(":");
      return {
        ip: ip?.trim() ?? "",
        hostname: parts[0]?.trim() ?? "",
        rack: parts[1]?.trim() ?? "",
      };
    });
}

/**
 * Parse the raw simulation output text and extract per-DC node balance data.
 *
 * The output contains one or more blocks like:
 *   Data Center: dc1
 *   Storage Policy: ...
 *   Host   Host Data Ownership (Raw TBs)  Number of Tokens/vNodes  Avg Per vNode
 *   *newhost   125.000   307   0.407 (-0.0%)
 *   existhost  125.068   307   0.407 (+0.1%)
 *   ...
 *   Highest average data ownership per vNode on a host: 0.407 TB (host)
 *   ...
 *   Max deviation degree: 0.1%
 *   For this storage policy, the simulation projects a good data balance.
 */
function parseSimulationOutput(output: string): DcBalance[] {
  const results: DcBalance[] = [];

  // Split into DC sections by "Data Center:" marker
  const dcSections = output.split(/^Data Center:/m).slice(1);

  for (const section of dcSections) {
    const lines = section.split("\n");
    const dcName = lines[0]?.trim() ?? "";

    // Storage policy
    const policyMatch = section.match(/^Storage Policy:\s*(.+)$/m);
    const storagePolicy = policyMatch ? policyMatch[1].trim() : "";

    // Total tokens from "DC: X, total tokens: N"
    const tokensMatch = output.match(new RegExp(`DC: ${dcName}, total tokens: (\\d+)`));
    const totalTokens = tokensMatch ? parseInt(tokensMatch[1], 10) : 0;

    // Node rows: optional "*", host, rawTB, tokens, avgPerVNode, deviation%
    // e.g. "*1.1.1.1_dc1_rack1   125.000   307   0.407 (-0.0%)"
    const nodePattern = /^(\*?)(\S+)\s+([\d.]+)\s+(\d+)\s+([\d.]+)\s+\(([-+][\d.]+)%\)/gm;
    const nodes: NodeBalance[] = [];
    let match: RegExpExecArray | null;
    while ((match = nodePattern.exec(section)) !== null) {
      nodes.push({
        host: match[2],
        isNew: match[1] === "*",
        rawTB: parseFloat(match[3]),
        tokens: parseInt(match[4], 10),
        avgPerVNode: parseFloat(match[5]),
        deviationPct: parseFloat(match[6]),
      });
    }

    if (nodes.length === 0) continue;

    // DC summary stats
    const avgMatch = section.match(/Data center average data ownership per vNode:\s*([\d.]+)/);
    const dcAvgPerVNode = avgMatch ? parseFloat(avgMatch[1]) : 0;

    const maxDevMatch = section.match(/Max deviation degree:\s*([\d.]+)%/);
    const maxDeviationPct = maxDevMatch ? parseFloat(maxDevMatch[1]) : 0;

    const deviatingMatch = section.match(
      /Number of hosts deviating from data center average by more than [\d.]+%:\s*(\d+)/
    );
    const deviatingHostsCount = deviatingMatch ? parseInt(deviatingMatch[1], 10) : 0;

    // Use maxDeviationPct as the source of truth — the simulator text can say "good balance"
    // even at e.g. 10.4% because it uses a strict > comparison internally.
    const isGoodBalance = maxDeviationPct <= 10;

    results.push({
      dc: dcName,
      storagePolicy,
      totalTokens,
      nodes,
      dcAvgPerVNode,
      maxDeviationPct,
      deviatingHostsCount,
      isGoodBalance,
    });
  }

  return results;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { id, runId } = await params;
  const run = await prisma.run.findFirst({
    where: { id: runId, customerId: id },
    include: { customer: true },
  });

  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const outputDir = run.outputDir;
  if (!outputDir || !fs.existsSync(outputDir)) {
    return NextResponse.json({ run, tokenMap: [], dcMap: [], hostnameMap: [], outputFiles: [] });
  }

  const files = fs.readdirSync(outputDir);
  const baseName = `${run.customer.name}_${
    run.customer.folderName.split("-").slice(-3).join("_")
  }`;

  const readFile = (suffix: string): string | null => {
    const candidates = files.filter((f) => f.endsWith(suffix));
    if (candidates.length === 0) return null;
    return fs.readFileSync(path.join(outputDir, candidates[0]), "utf-8");
  };

  const tokenMapContent = readFile("_tokenmap.txt");
  const dcMapContent = readFile("_dc.txt");
  const hostnameMapContent = readFile("_hostname.txt");

  const outputFiles = files.map((f) => ({
    name: f,
    size: fs.statSync(path.join(outputDir, f)).size,
  }));

  const dcBalance = run.output ? parseSimulationOutput(run.output) : [];

  return NextResponse.json({
    run,
    baseName,
    tokenMap: tokenMapContent ? parseTokenMap(tokenMapContent) : [],
    dcMap: dcMapContent ? parseDcMap(dcMapContent) : [],
    hostnameMap: hostnameMapContent ? parseHostnameMap(hostnameMapContent) : [],
    outputFiles,
    dcBalance,
  });
}
