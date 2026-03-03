import { ChildProcess } from "child_process";

// Use globalThis to survive hot-module reloads in dev
const g = globalThis as { __procRegistry?: Map<string, ChildProcess> };
if (!g.__procRegistry) g.__procRegistry = new Map();

export const processRegistry = g.__procRegistry;

export function registerProcess(runId: string, proc: ChildProcess) {
  processRegistry.set(runId, proc);
}

export function getProcess(runId: string): ChildProcess | undefined {
  return processRegistry.get(runId);
}

export function unregisterProcess(runId: string) {
  processRegistry.delete(runId);
}
