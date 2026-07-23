import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 2026-07-16 - pdfkit lee .afm desde disco; si Next lo empaqueta, __dirname
  // apunta a C:\ROOT\... y falla con ENOENT Helvetica.afm
  serverExternalPackages: ["pdfkit", "fontkit", "linebreak", "png-js", "qrcode"],
  // 2026-07-18 - Permitir probar desde el celular en la LAN (npm run dev -- --hostname 0.0.0.0).
  // Sin esto Next bloquea /_next/* y la página se ve pero los onClick no hidratan/no responden.
  allowedDevOrigins: ["192.168.4.3"],
};

export default nextConfig;
