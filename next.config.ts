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
};

export default nextConfig;
