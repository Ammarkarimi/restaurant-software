import type { NextConfig } from "next";

// Sent with every page and API answer.
const securityHeaders = [
  // No other site may show Billspoon inside a frame (tricking a cashier into clicking buttons).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  // Files are only ever read as the type they are sent as.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Addresses of Billspoon pages (bill links, table codes) are not passed to other sites.
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
