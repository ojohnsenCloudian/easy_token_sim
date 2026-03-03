import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { customerDir, FILE_NAMES } from "@/lib/paths";
import fs from "fs";
import path from "path";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Remove customer folder and all its contents from disk
  const dir = customerDir(customer.folderName);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // Remove DB record (cascades to runs)
  await prisma.customer.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      runs: { orderBy: { startedAt: "desc" } },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dir = customerDir(customer.folderName);
  const files = {
    ring: fs.existsSync(path.join(dir, FILE_NAMES.ring)),
    status: fs.existsSync(path.join(dir, FILE_NAMES.status)),
    config: fs.existsSync(path.join(dir, FILE_NAMES.config)),
  };

  return NextResponse.json({ ...customer, files });
}
