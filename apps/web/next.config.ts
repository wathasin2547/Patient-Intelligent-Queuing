import path from "node:path";
import type { NextConfig } from "next";

// The repo root (code/) holds shared mock data in data/catalog.json,
// so Turbopack must be allowed to resolve files above apps/web.
const repoRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  // อนุญาตให้เปิด dev server ผ่านโดเมน ngrok (ไม่ต้องใส่ https://)
  allowedDevOrigins: ["affidavit-manlike-corncob.ngrok-free.dev"],
};



export default nextConfig;
