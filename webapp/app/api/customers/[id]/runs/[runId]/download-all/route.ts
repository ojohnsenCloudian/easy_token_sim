import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import archiver from "archiver";
import fs from "fs";
import { PassThrough } from "stream";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { id, runId } = await params;
  const run = await prisma.run.findFirst({
    where: { id: runId, customerId: id },
    include: { customer: true },
  });

  if (!run || !run.outputDir || !fs.existsSync(run.outputDir)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const zipName = `${run.customer.folderName}_run-${runId.slice(-8)}.zip`;

  // Pipe archiver into a PassThrough, then wrap in a Web ReadableStream
  const passThrough = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 6 } });

  archive.on("error", (err) => {
    console.error("archiver error", err);
    passThrough.destroy(err);
  });

  archive.pipe(passThrough);
  archive.directory(run.outputDir, false);
  archive.finalize();

  const webStream = new ReadableStream({
    start(controller) {
      passThrough.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      passThrough.on("end", () => controller.close());
      passThrough.on("error", (err) => controller.error(err));
    },
  });

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control": "no-store",
    },
  });
}
