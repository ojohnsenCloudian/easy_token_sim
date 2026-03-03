import * as yaml from "js-yaml";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PolicyType = "rf" | "ec" | "hybrid";

export interface RfPolicy {
  type: "rf";
  rf: number;
  replicasInDc?: number; // if absent = all replicas in this DC
}

export interface EcPolicy {
  type: "ec";
  k: number;
  m: number;
  fragsInDc?: number; // if absent = all fragments (k+m) in this DC
}

export interface HybridPolicy {
  type: "hybrid";
  k: number;
  m: number;
  fragsInDc: number;
  rfReplicas: number;
}

export type Policy = RfPolicy | EcPolicy | HybridPolicy;

export interface RackEntry {
  name: string;
  count: number;
}

export interface DcEntry {
  dcName: string;
  numNodes: number;
  nodeCapacityTb: number;
  policies: Policy[];
  racks: RackEntry[];
}

/** A real node being added, mapped to a DC and rack for hostname reporting */
export interface NodeToAdd {
  hostname: string;
  dc: string;
  rack: string;
}

export interface ConfigFormData {
  customerName: string;
  region: string;
  cumulative: boolean;
  preferredTokenNumber?: number;
  dcEntries: DcEntry[];
  nodesToAdd: NodeToAdd[];
}

// ─── Policy serialization ─────────────────────────────────────────────────────

function serializePolicy(p: Policy): string {
  if (p.type === "rf") {
    return p.replicasInDc != null ? `${p.rf}:${p.replicasInDc}` : `${p.rf}`;
  }
  if (p.type === "ec") {
    if (p.fragsInDc != null && p.fragsInDc !== p.k + p.m) {
      return `${p.k}+${p.m}:${p.fragsInDc}`;
    }
    return `${p.k}+${p.m}`;
  }
  // hybrid
  return `${p.k}+${p.m}:${p.fragsInDc}_${p.rfReplicas}`;
}

function parsePolicy(s: string): Policy {
  const parts = s.trim().split(":");
  if (parts.length === 1) {
    const ecParts = parts[0].split("+");
    if (ecParts.length === 2) {
      return { type: "ec", k: parseInt(ecParts[0]), m: parseInt(ecParts[1]) };
    }
    return { type: "rf", rf: parseInt(parts[0]) };
  }
  const lhs = parts[0].trim();
  const rhs = parts[1].trim();
  const ecParts = lhs.split("+");
  if (ecParts.length === 2) {
    const k = parseInt(ecParts[0]);
    const m = parseInt(ecParts[1]);
    const rhsParts = rhs.split("_");
    const fragsInDc = parseInt(rhsParts[0]);
    if (rhsParts.length === 2) {
      return { type: "hybrid", k, m, fragsInDc, rfReplicas: parseInt(rhsParts[1]) };
    }
    return { type: "ec", k, m, fragsInDc };
  }
  return { type: "rf", rf: parseInt(lhs), replicasInDc: parseInt(rhs) };
}

// ─── DC entry serialization ───────────────────────────────────────────────────

function serializeDcEntry(dc: DcEntry): string {
  const policyStr = dc.policies.map(serializePolicy).join(",");
  let entry = `${dc.dcName};${dc.numNodes};${dc.nodeCapacityTb};${policyStr}`;
  if (dc.racks.length > 0) {
    const rackStr = dc.racks.map((r) => `${r.name}:${r.count}`).join(",");
    entry += `;${rackStr}`;
  }
  return entry;
}

function parseDcEntry(s: string): DcEntry {
  const parts = s.split(";").map((p) => p.trim());
  const dcName = parts[0] ?? "";
  const numNodes = parseInt(parts[1] ?? "0");
  const nodeCapacityTb = parseInt(parts[2] ?? "0");
  const policies = (parts[3] ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map(parsePolicy);
  const racks: RackEntry[] = [];
  if (parts[4]) {
    parts[4].split(",").forEach((r) => {
      const [name, countStr] = r.trim().split(":");
      if (name && countStr) {
        racks.push({ name: name.trim(), count: parseInt(countStr) });
      }
    });
  }
  return { dcName, numNodes, nodeCapacityTb, policies, racks };
}

// ─── nodes_to_add serialization ───────────────────────────────────────────────

function serializeNodeToAdd(n: NodeToAdd): string {
  return `${n.hostname}:${n.dc}:${n.rack}`;
}

function parseNodeToAdd(s: string): NodeToAdd {
  const parts = s.split(":");
  return {
    hostname: parts[0]?.trim() ?? "",
    dc: parts[1]?.trim() ?? "",
    rack: parts[2]?.trim() ?? "",
  };
}

// ─── Full config serialization ────────────────────────────────────────────────

export function formToYaml(data: ConfigFormData): string {
  const obj: Record<string, unknown> = {
    customer_name: data.customerName,
    hss_ring_output: "hsstool-ring.txt",
    hss_status_output: "hsstool-status.txt",
    dc_for_nodes: data.dcEntries.map(serializeDcEntry),
    region: data.region,
    cumulative: data.cumulative ? "True" : "False",
  };
  if (data.nodesToAdd.length > 0) {
    obj.nodes_to_add = data.nodesToAdd
      .filter((n) => n.hostname.trim())
      .map(serializeNodeToAdd);
  }
  if (data.preferredTokenNumber && data.preferredTokenNumber > 0) {
    obj.preferred_token_number = data.preferredTokenNumber;
  }
  return "---\n" + yaml.dump(obj, { lineWidth: 120, quotingType: '"' });
}

export function yamlToForm(content: string): ConfigFormData | null {
  try {
    const docs = yaml.loadAll(content) as Record<string, unknown>[];
    const doc = docs[0];
    if (!doc || typeof doc !== "object") return null;

    const dcForNodes = (doc.dc_for_nodes as string[] | undefined) ?? [];
    const rawNodes = (doc.nodes_to_add as string[] | undefined) ?? [];

    return {
      customerName: (doc.customer_name as string) ?? "",
      region: (doc.region as string) ?? "us_east",
      cumulative: String(doc.cumulative ?? "True").toLowerCase() === "true",
      preferredTokenNumber:
        typeof doc.preferred_token_number === "number"
          ? doc.preferred_token_number
          : undefined,
      dcEntries: dcForNodes.map((s) => parseDcEntry(String(s))),
      nodesToAdd: rawNodes.map((s) => parseNodeToAdd(String(s))),
    };
  } catch {
    return null;
  }
}

export function emptyConfig(customerName: string): ConfigFormData {
  return {
    customerName,
    region: "us_east",
    cumulative: true,
    dcEntries: [
      {
        dcName: "dc1",
        numNodes: 1,
        nodeCapacityTb: 100,
        policies: [{ type: "rf", rf: 3 }],
        racks: [],
      },
    ],
    nodesToAdd: [],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** All unique DC names from dcEntries */
export function getDcNames(data: ConfigFormData): string[] {
  return data.dcEntries.map((dc) => dc.dcName).filter(Boolean);
}

/** All unique rack names across all DC entries */
export function getAllRackNames(data: ConfigFormData): string[] {
  const names = new Set<string>();
  data.dcEntries.forEach((dc) => dc.racks.forEach((r) => names.add(r.name)));
  return Array.from(names);
}
