import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: {"/objects/*": ["./assets/demo/objects/*.webp"]},
};
export default config;
