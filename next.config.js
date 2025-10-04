// next.config.js (ES Module 버전)
/** @type {import('next').NextConfig} */
const nextConfig = {
  // public 폴더의 정적 파일 우선 제공
  async rewrites() {
    return [
      {
        source: "/",
        destination: "/index.html",
      },
    ];
  },
};

export default nextConfig;
