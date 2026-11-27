import type { NextConfig } from "next";

const localPreview = process.env.ROOMLET_EMBEDDED_BUILD === "1";

const config: NextConfig = {
  distDir: localPreview ? ".roomlet-demo/build" : ".next",
  typescript: { tsconfigPath: localPreview ? "tsconfig.demo.json" : "tsconfig.json" },
  experimental: { useTypeScriptCli: false, workerThreads: true, ...(process.env.ROOMLET_SMALL_BUILD === "true" && {cpus:1, webpackBuildWorker:false}), ...(localPreview && { webpackBuildWorker: false, cpus: 2 }) },
  devIndicators: false,
  async headers() {
    const headers = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return ["/studio/:path*", "/design-system/:path*", "/api/:path*", "/objects/:path*"].map(source => ({ source, headers }));
  },
};
export default config;
