import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 2026-07-16 - pdfkit lee .afm desde disco; si Next lo empaqueta, __dirname
  // apunta a C:\ROOT\... y falla con ENOENT Helvetica.afm
  // 2026-10-08 - tesseract.js arranca un worker_thread desde su propio archivo: no se debe empaquetar.
  serverExternalPackages: ["pdfkit", "fontkit", "linebreak", "png-js", "qrcode", "tesseract.js", "sharp"],
  // 2026-10-08 - OCR Beca SEP: el idioma español y el motor wasm se leen de disco en tiempo de ejecución,
  // así que hay que incluirlos a mano en la función que sube documentos (Vercel).
  outputFileTracingIncludes: {
    "/api/sep/documento": [
      "./node_modules/@tesseract.js-data/spa/4.0.0_best_int/**",
      "./node_modules/tesseract.js-core/tesseract-core-*lstm.*",
      "./node_modules/tesseract.js-core/index.js",
      "./node_modules/tesseract.js-core/package.json",
    ],
  },
  // 2026-07-18 - Permitir probar desde el celular en la LAN (npm run dev -- --hostname 0.0.0.0).
  // Sin esto Next bloquea /_next/* y la página se ve pero los onClick no hidratan/no responden.
  allowedDevOrigins: ["192.168.4.3"],
};

export default nextConfig;
