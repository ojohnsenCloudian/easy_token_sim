import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { getProcess } from "@/lib/process-registry";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { runId } = await params;
  const { value } = await req.json();

  const proc = getProcess(runId);
  if (!proc || !proc.stdin) {
    return NextResponse.json(
      { error: "Process not found or already completed" },
      { status: 404 }
    );
  }

  proc.stdin.write(value + "\n");
  return NextResponse.json({ ok: true });
}
