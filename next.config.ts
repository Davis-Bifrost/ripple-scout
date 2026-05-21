import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "60mb",
    },
    // Next 15.5+ truncates request bodies passing through middleware to 10MB
    // by default, which corrupts multipart Server Action uploads even when
    // bodySizeLimit above is set. Raise this in lockstep with bodySizeLimit.
    middlewareClientMaxBodySize: "60mb",
  },
};

export default nextConfig;
