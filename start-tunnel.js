/**
 * Cloudflare Quick Tunnel + QR Code
 * รัน: node start-tunnel.js
 *
 * → แสดง URL + QR Code → สแกนด้วยมือถือได้เลย
 * → ไม่ต้องพิมพ์ URL ยาวๆ
 */

const { spawn }  = require('child_process');
const fs         = require('fs');
const path       = require('path');
const qrcode     = require('qrcode-terminal');

function updateEnv(filePath, key, value) {
  if (!fs.existsSync(filePath)) return;
  let c = fs.readFileSync(filePath, 'utf8');
  const re = new RegExp(`^${key}=.*$`, 'm');
  c = re.test(c) ? c.replace(re, `${key}=${value}`) : c + `\n${key}=${value}`;
  fs.writeFileSync(filePath, c, 'utf8');
}

function getTunnelUrl(port, label) {
  return new Promise((resolve, reject) => {
    let done = false;
    process.stdout.write(`  ⏳ ${label} tunnel...`);

    const proc = spawn('cloudflared', [
      'tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate',
    ], { shell: true });

    const parse = (data) => {
      // Quick tunnel URLs have format: word-word-word-word.trycloudflare.com (multiple hyphens)
      const match = data.toString().match(/https:\/\/[a-z][a-z0-9]*(?:-[a-z0-9]+){2,}\.trycloudflare\.com/);
      if (match && !done) {
        done = true;
        process.stdout.write(`\r  ✅ ${label}: ${match[0]}\n`);
        resolve({ url: match[0], proc });
      }
    };

    proc.stderr.on('data', parse);
    proc.stdout.on('data', parse);
    proc.on('error', (e) => reject(new Error(e.message)));
    setTimeout(() => { if (!done) reject(new Error('Timeout — cloudflared ไม่ตอบสนอง')); }, 40000);
  });
}

const serverEnv = path.join(__dirname, 'server', '.env');
const clientEnv = path.join(__dirname, 'client', '.env.local');

(async () => {
  console.clear();
  console.log(`
╔══════════════════════════════════════════════╗
║   🃏  CardMatch — Cloudflare Quick Tunnel   ║
╚══════════════════════════════════════════════╝
`);

  // Reset HTTPS local (ไม่ต้องใช้ HTTPS local)
  updateEnv(serverEnv, 'HTTPS_ENABLED', 'false');

  try {
    // ── Tunnel Server ──────────────────────────────────────────────
    const srv = await getTunnelUrl(5000, 'Server API  ');
    updateEnv(clientEnv, 'NEXT_PUBLIC_SERVER_URL', srv.url);

    // ── Tunnel Client ──────────────────────────────────────────────
    const cli = await getTunnelUrl(3000, 'Client Web  ');
    updateEnv(serverEnv, 'CLIENT_URL', cli.url);

    // ── Save URL to file for reference ─────────────────────────────
    const urlFile = path.join(__dirname, 'CURRENT_URL.txt');
    fs.writeFileSync(urlFile, cli.url, 'utf8');

    // ── Display ────────────────────────────────────────────────────
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                   🎉  พร้อมเล่นแล้ว!                        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  📱  สแกน QR Code หรือเปิด URL นี้บนมือถือ:                ║
║                                                              ║
║  ${cli.url.padEnd(60)}║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║  ✅  กล้อง/ไมค์ทำงานได้ทันที — ไม่ต้องติดตั้งอะไร          ║
╚══════════════════════════════════════════════════════════════╝
`);

    // ── QR Code ────────────────────────────────────────────────────
    console.log('  📷  QR Code (สแกนได้เลย):\n');
    qrcode.generate(cli.url, { small: true });

    console.log(`
─────────────────────────────────────────────────
  ⚠️  URL เปลี่ยนทุกครั้งที่รัน script นี้ใหม่
  📄  URL บันทึกไว้ที่: CURRENT_URL.txt
─────────────────────────────────────────────────
  ⚠️  Restart server + client เพื่อโหลด URL ใหม่:
     Terminal 1: cd server && npm run dev
     Terminal 2: cd client && npm run dev
─────────────────────────────────────────────────
  กด Ctrl+C เพื่อหยุด tunnels
`);

    // ── Keep running ────────────────────────────────────────────────
    process.on('SIGINT', () => {
      console.log('\n🛑 หยุด tunnels แล้ว\n');
      srv.proc.kill();
      cli.proc.kill();
      process.exit(0);
    });

    setInterval(() => {}, 60000);

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}\n`);
    console.error('ตรวจสอบว่า cloudflared ติดตั้งแล้ว: cloudflared --version\n');
    process.exit(1);
  }
})();
