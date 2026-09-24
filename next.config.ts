import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "twilio",
    "pg",
    "livekit-server-sdk",
    "@livekit/agents",
    "@livekit/agents-plugin-cartesia",
    "@livekit/agents-plugin-openai",
  ],
};

export default nextConfig;
