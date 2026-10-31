import type { NextConfig } from "next";

// DEMO=1：用本地假资料预览界面（不连 Firebase）。正式部署不要设定 DEMO。
const demo = process.env.DEMO === "1";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin", "@googleapis/calendar", "google-auth-library"],
  ...(demo
    ? {
        env: { NEXT_PUBLIC_FIREBASE_API_KEY: "demo", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo" },
        turbopack: {
          resolveAlias: {
            "firebase/app": "./demo/app.ts",
            "firebase/auth": "./demo/auth.ts",
            "firebase/firestore": "./demo/firestore.ts",
          },
        },
      }
    : {}),
};

export default nextConfig;
