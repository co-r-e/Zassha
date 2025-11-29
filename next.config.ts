import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // ルート誤検知を防ぐため、プロジェクト直下を明示
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
