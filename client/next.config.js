/** @type {import('next').NextConfig} */

// Read LAN IP from .env.local (set by setup-lan.js)
// Used to allow HMR WebSocket connections from other devices on the network
const lanIp = process.env.NEXT_PUBLIC_LAN_IP || '';

const nextConfig = {
  reactStrictMode: false,
  env: {
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000',
  },
  // allowedDevOrigins: exact IP/hostname strings only — wildcards not supported
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    // Add LAN IP if configured (e.g. 192.168.1.56)
    ...(lanIp ? [lanIp] : []),
  ],
};

module.exports = nextConfig;
