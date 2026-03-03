import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { customerDir, FILE_NAMES, SIMULATOR_DIR } from "@/lib/paths";
import { registerProcess, unregisterProcess } from "@/lib/process-registry";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export const maxDuration = 300;

// Known interactive prompts from simulate_add_node.py
const PROMPT_PATTERNS = [
  {
    pattern: /Press 1 to continue, Press 0 to exit/,
    promptId: "confirm_continue",
    text: "The simulator has displayed the cluster expansion plan and is waiting for your confirmation.",
    options: [
      { label: "Continue simulation", value: "1", variant: "default" as const },
      { label: "Exit", value: "0", variant: "destructive" as const },
    ],
  },
  {
    pattern: /Continue: \(y\/n\)/,
    promptId: "confirm_new_dc",
    text: "A DC name in your config was not found in the ring file. This may mean you are adding a new DC. Do you want to continue?",
    options: [
      { label: "Yes, continue", value: "y", variant: "default" as const },
      { label: "No, exit", value: "n", variant: "destructive" as const },
    ],
  },
];

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dir = customerDir(customer.folderName);
  const allFilesExist = [FILE_NAMES.ring, FILE_NAMES.status, FILE_NAMES.config].every(
    (f) => fs.existsSync(path.join(dir, f))
  );
  if (!allFilesExist) {
    return NextResponse.json(
      { error: "All three files (ring, status, config) must be uploaded first" },
      { status: 400 }
    );
  }

  const run = await prisma.run.create({
    data: { customerId: id, status: "running" },
  });

  const outputDir = path.join(dir, "output", run.id);
  const logsDir = path.join(dir, "logs");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });

  await prisma.run.update({
    where: { id: run.id },
    data: { outputDir },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: data })}\n\n`));
      };
      const sendEvent = (event: string, data: object) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      sendEvent("run_id", { runId: run.id });

      const proc = spawn(
        "python3",
        ["/app/run_customer.py", customer.folderName, run.id, outputDir],
        {
          cwd: SIMULATOR_DIR,
          env: {
            ...process.env,
            PYTHONUNBUFFERED: "1",
          },
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      registerProcess(run.id, proc);

      let outputBuffer = "";
      // Rolling buffer for prompt detection (last 512 chars is enough)
      let rollingTail = "";
      const TAIL_SIZE = 512;
      // Track which prompts have been emitted to avoid re-firing on the same text
      const emittedPrompts = new Set<string>();

      const onData = (chunk: Buffer) => {
        const text = chunk.toString();
        outputBuffer += text;
        rollingTail = (rollingTail + text).slice(-TAIL_SIZE);
        send(text);

        // Check if the latest output ends with a known prompt
        for (const p of PROMPT_PATTERNS) {
          if (!emittedPrompts.has(p.promptId) && p.pattern.test(rollingTail)) {
            emittedPrompts.add(p.promptId);
            sendEvent("prompt", {
              promptId: p.promptId,
              text: p.text,
              options: p.options,
            });
            // Allow the same prompt to fire again after a response is written
            // (e.g. if the simulator loops). Re-enable after a short delay.
            setTimeout(() => emittedPrompts.delete(p.promptId), 2000);
            break;
          }
        }
      };

      proc.stdout.on("data", onData);
      proc.stderr.on("data", onData);

      proc.on("close", async (code) => {
        unregisterProcess(run.id);
        const status = code === 0 ? "completed" : "failed";
        await prisma.run.update({
          where: { id: run.id },
          data: { status, output: outputBuffer, completedAt: new Date() },
        });
        sendEvent("done", { runId: run.id, status, exitCode: code });
        controller.close();
      });

      proc.on("error", async (err) => {
        unregisterProcess(run.id);
        const msg = `\nProcess error: ${err.message}`;
        outputBuffer += msg;
        send(msg);
        await prisma.run.update({
          where: { id: run.id },
          data: { status: "failed", output: outputBuffer, completedAt: new Date() },
        });
        sendEvent("done", { runId: run.id, status: "failed", exitCode: -1 });
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
