import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Visit photos/croquis go browser -> S3 with presigned URLs (PUT) and are shown from presigned GETs.
const s3 = `https://${process.env.S3_BUCKET_NAME ?? "mejoramiento-vivienda"}.s3.${process.env.AWS_REGION ?? "us-east-1"}.amazonaws.com`;

// Inline script is required by the no-flash theme snippet; Next also injects inline bootstrap scripts.
// ponytail: 'unsafe-inline' on script-src; move to a nonce-based CSP via middleware if a stricter policy is required.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://apis.google.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${s3}`,
  "font-src 'self'",
  `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com ${s3}` +
    (isDev ? " http://127.0.0.1:* http://localhost:* ws://localhost:*" : ""),
  `frame-src https://*.firebaseapp.com https://accounts.google.com ${s3}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Generic framework guidance only; stop `next dev` from regenerating AGENTS.md.
  agentRules: false,
  // Set by `next upgrade --agent=security` (16.4.3 -> 16.4.6, security advisory).
  experimental: { agentUpgrade: "security" },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Camera for document/visit photos; geolocation for the visit coordinate on submit; everything else denied.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
          // Firebase popup sign-in needs window.opener access.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
