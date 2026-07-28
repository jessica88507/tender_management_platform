import { networkInterfaces } from "os";
import type { NextConfig } from "next";

// LAN IP changes across networks/DHCP leases, so derive it at startup instead
// of hardcoding one address — otherwise dev-server HMR breaks silently every
// time this machine gets a new IP (see docs/DECISIONS.md).
function getLanIPs(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === "IPv4" && !iface.internal)
    .map((iface) => iface!.address);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getLanIPs(),
  // These ship native binaries / WASM / worker scripts that must be resolved via plain `require()`
  // at runtime, not processed by the bundler — bundling @napi-rs/canvas in particular breaks with
  // "Cannot find native binding" otherwise (used by src/lib/tenderExtract for scanned-PDF OCR).
  serverExternalPackages: ["@napi-rs/canvas", "tesseract.js", "pdfjs-dist"],
};

export default nextConfig;
