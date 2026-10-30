/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The app never uses next/image, so the built-in image optimizer is switched off.
  // npm audit lists critical advisories against that endpoint in Next 14.2.x (for
  // example GHSA-2xp9-vwfh-vxw4); disabling it removes it from the attack surface
  // until Next.js is upgraded. If next/image is adopted later, upgrade Next first.
  images: { unoptimized: true },
};

export default nextConfig;
