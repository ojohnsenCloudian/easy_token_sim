import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { CUSTOMERS_DIR, customerDir, FILE_NAMES } from "@/lib/paths";
import fs from "fs";
import path from "path";

export async function GET() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });

  const result = customers.map((c) => {
    const dir = customerDir(c.folderName);
    const files = {
      ring: fs.existsSync(path.join(dir, FILE_NAMES.ring)),
      status: fs.existsSync(path.join(dir, FILE_NAMES.status)),
      config: fs.existsSync(path.join(dir, FILE_NAMES.config)),
    };
    return {
      ...c,
      files,
      lastRun: c.runs[0] ?? null,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const clean = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const folderName = `${clean}-${dd}-${mm}-${yyyy}`;

  const exists = await prisma.customer.findUnique({ where: { folderName } });
  if (exists) {
    return NextResponse.json(
      { error: `Customer folder "${folderName}" already exists` },
      { status: 409 }
    );
  }

  const dir = path.join(CUSTOMERS_DIR, folderName);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "output"), { recursive: true });
  fs.mkdirSync(path.join(dir, "logs"), { recursive: true });

  const customer = await prisma.customer.create({
    data: { name: clean, folderName },
  });

  return NextResponse.json(customer, { status: 201 });
}
