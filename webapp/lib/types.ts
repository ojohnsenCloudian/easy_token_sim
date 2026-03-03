export interface CustomerSummary {
  id: string;
  name: string;
  folderName: string;
  createdAt: string;
  files: { ring: boolean; status: boolean; config: boolean };
  lastRun: RunSummary | null;
}

export interface CustomerDetail {
  id: string;
  name: string;
  folderName: string;
  createdAt: string;
  files: { ring: boolean; status: boolean; config: boolean };
  runs: RunSummary[];
}

export interface RunSummary {
  id: string;
  customerId: string;
  status: "running" | "completed" | "failed";
  output: string | null;
  outputDir: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface NodeBalance {
  host: string;
  isNew: boolean;
  rawTB: number;
  tokens: number;
  avgPerVNode: number;
  deviationPct: number;
}

export interface DcBalance {
  dc: string;
  storagePolicy: string;
  totalTokens: number;
  nodes: NodeBalance[];
  dcAvgPerVNode: number;
  maxDeviationPct: number;
  deviatingHostsCount: number;
  isGoodBalance: boolean;
}

export interface ResultsData {
  run: RunSummary;
  baseName: string;
  tokenMap: Array<{ token: string; ip: string }>;
  dcMap: Array<{ dc: string; nodes: string[] }>;
  hostnameMap: Array<{ ip: string; hostname: string; rack: string }>;
  outputFiles: Array<{ name: string; size: number }>;
  dcBalance: DcBalance[];
}
