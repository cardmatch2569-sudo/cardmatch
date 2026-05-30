/**
 * LAN Setup Script
 * รันครั้งเดียวก่อนเริ่มใช้งานบน LAN:  node setup-lan.js
 */

const os   = require('os');
const fs   = require('fs');
const path = require('path');

// ── Detect LAN IP ─────────────────────────────────────────────────
function getLanIP() {
  const nets = os.networkInterfaces();
  const results = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push({ name, address: net.address });
      }
    }
  }

  // Priority: 192.168.x → 10.x → 172.x → first found
  return (
    results.find(r => r.address.startsWith('192.168.'))?.address ||
    results.find(r => r.address.startsWith('10.'))?.address ||
    results.find(r => r.address.startsWith('172.'))?.address ||
    results[0]?.address ||
    'localhost'
  );
}

// ── Update a value in .env file ────────────────────────────────────
function updateEnv(filePath, key, value) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠️  File not found: ${filePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

// ── Main ───────────────────────────────────────────────────────────
const ip = getLanIP();

const serverEnvPath = path.join(__dirname, 'server', '.env');
const clientEnvPath = path.join(__dirname, 'client', '.env.local');

console.log('\n🔍 ตรวจสอบ LAN IP...');
console.log(`   พบ IP: ${ip}`);

console.log('\n📝 อัปเดต server/.env...');
updateEnv(serverEnvPath, 'CLIENT_URL',     `http://${ip}:3000`);
updateEnv(serverEnvPath, 'SERVER_HOST',    '0.0.0.0');

console.log('📝 อัปเดต client/.env.local...');
updateEnv(clientEnvPath, 'NEXT_PUBLIC_SERVER_URL', `http://${ip}:5000`);
updateEnv(clientEnvPath, 'NEXT_PUBLIC_LAN_IP',     ip);

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  LAN Setup เสร็จแล้ว!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  IP ของคุณ  :  ${ip}
  Backend    :  http://${ip}:5000
  Frontend   :  http://${ip}:3000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  แชร์ให้เครื่องอื่นในวงแลน:
  👉  http://${ip}:3000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ขั้นตอนถัดไป:
  1. เปิด Port 3000 และ 5000 ใน Windows Firewall (รันด้านล่าง)
  2. เพิ่ม http://${ip}:3000 ใน Google Console (Authorized origins)
  3. รัน server:  cd server && npm run dev
  4. รัน client:  cd client && npm run dev

คำสั่งเปิด Firewall (รันใน PowerShell ในฐานะ Admin):
  netsh advfirewall firewall add rule name="CardMatch Server" dir=in action=allow protocol=TCP localport=5000
  netsh advfirewall firewall add rule name="CardMatch Client" dir=in action=allow protocol=TCP localport=3000
`);
