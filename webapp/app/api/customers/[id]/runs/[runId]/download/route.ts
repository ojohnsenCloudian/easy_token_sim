import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { id, runId } = await params;
  const filename = req.nextUrl.searchParams.get("file");

  if (!filename) {
    return NextResponse.json({ error: "file param required" }, { status: 400 });
  }

  const run = await prisma.run.findFirst({ where: { id: runId, customerId: id } });
  if (!run || !run.outputDir) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(run.outputDir, filename);
  if (!fs.existsSync(filePath) || !filePath.startsWith(run.outputDir)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const content = fs.readFileSync(filePath);
  return new NextResponse(content, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/octet-stream",
    },
  });
}
