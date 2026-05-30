/**
 * HTTPS Setup Script
 * รัน: node setup-https.js
 *
 * สร้าง self-signed certificate สำหรับ HTTPS บน LAN
 * จำเป็นสำหรับการใช้กล้อง/ไมค์บน iPhone/Android บนวง LAN
 */

const selfsigned = require('./server/node_modules/selfsigned');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Detect LAN IP ─────────────────────────────────────────────────
function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal &&
          (net.address.startsWith('192.168.') || net.address.startsWith('10.'))) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const ip = getLanIP();
const certsDir = path.join(__dirname, 'certs');
fs.mkdirSync(certsDir, { recursive: true });

console.log(`\n🔒 สร้าง HTTPS Certificate สำหรับ IP: ${ip}\n`);

// ── Generate self-signed cert ─────────────────────────────────────
const attrs = [
  { name: 'commonName',       value: ip },
  { name: 'organizationName', value: 'CardMatch' },
  { name: 'countryName',      value: 'TH' },
];

const pems = selfsigned.generate(attrs, {
  days:      365,
  algorithm: 'sha256',
  keySize:   2048,
  extensions: [
    {
      name:     'subjectAltName',
      altNames: [
        { type: 7, ip: ip },           // LAN IP
        { type: 7, ip: '127.0.0.1' }, // localhost
        { type: 2, value: 'localhost' },
      ],
    },
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', keyCertSign: true, digitalSignature: true },
    { name: 'extKeyUsage', serverAuth: true },
  ],
});

// Save files
const keyPath  = path.join(certsDir, 'key.pem');
const certPath = path.join(certsDir, 'cert.pem');
fs.writeFileSync(keyPath,  pems.private);
fs.writeFileSync(certPath, pems.cert);

// Also save the cert as .crt for iPhone install
const crtPath = path.join(certsDir, 'cardmatch-cert.crt');
fs.writeFileSync(crtPath, pems.cert);

// ── Update .env files ─────────────────────────────────────────────
function updateEnv(filePath, updates) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) content = content.replace(regex, `${key}=${value}`);
    else content += `\n${key}=${value}`;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

updateEnv(path.join(__dirname, 'server', '.env'), {
  CLIENT_URL:        `https://${ip}:3000`,
  HTTPS_ENABLED:     'true',
  LAN_IP:            ip,
  SERVER_HOST:       '0.0.0.0',
});

updateEnv(path.join(__dirname, 'client', '.env.local'), {
  NEXT_PUBLIC_SERVER_URL: `https://${ip}:5000`,
  NEXT_PUBLIC_LAN_IP:     ip,
});

// ── Instructions ──────────────────────────────────────────────────
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  HTTPS Certificate สร้างเสร็จแล้ว!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LAN IP   : ${ip}
  Website  : https://${ip}:3000
  Server   : https://${ip}:5000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 ขั้นตอนติดตั้ง Certificate บน iPhone/iPad:
─────────────────────────────────────────────
  1. เปิด https://${ip}:5000/cert บน iPhone
     (กด "Advanced" → "Proceed anyway" ถ้าเบราว์เซอร์เตือน)
  2. กด "Allow" เพื่อดาวน์โหลด Profile
  3. ไปที่ Settings → Profile Downloaded → Install
  4. ไปที่ Settings → General → About → Certificate Trust Settings
  5. เปิด "CardMatch" → Trust → Continue
  6. รีเฟรชเบราว์เซอร์ เปิด https://${ip}:3000

🖥  ขั้นตอนรัน:
─────────────
  Terminal 1:  cd server && npm run dev
  Terminal 2:  cd client && npm run dev
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
