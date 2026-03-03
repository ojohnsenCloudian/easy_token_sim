import path from "path";

export const DATA_DIR = process.env.DATA_DIR ?? "/data";
export const CUSTOMERS_DIR = path.join(DATA_DIR, "customers");
export const SIMULATOR_DIR = "/app/expansion-simulator";
export const RUN_CUSTOMER_SCRIPT = "/app/run_customer.py";

export function customerDir(folderName: string): string {
  return path.join(CUSTOMERS_DIR, folderName);
}

export function customerFile(folderName: string, filename: string): string {
  return path.join(CUSTOMERS_DIR, folderName, filename);
}

export const FILE_NAMES = {
  ring: "hsstool-ring.txt",
  status: "hsstool-status.txt",
  config: "customer_info.yaml",
} as const;

export type FileType = keyof typeof FILE_NAMES;
