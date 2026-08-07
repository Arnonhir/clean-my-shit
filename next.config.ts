import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundles a self-contained server (its own copy of the node_modules it
  // actually needs) into .next/standalone, so the packaged desktop app
  // doesn't need to ship the whole node_modules tree or run `npm install`
  // on the end user's machine.
  output: "standalone",
};

export default nextConfig;
