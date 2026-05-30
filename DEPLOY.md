# วิธี Deploy CardMatch (แนะนำ)

## ทำไมต้อง Deploy?
- ผู้เล่นเข้าได้จากทุกที่ — ไม่ต้องอยู่ LAN เดียวกัน
- HTTPS จริง — กล้อง/ไมค์ทำงานบนมือถือทันที
- ไม่ต้องติดตั้งอะไรบนมือถือผู้เล่น

---

## ตัวเลือกที่ฟรีและง่ายที่สุด

### Frontend (Next.js) → Vercel
1. สมัคร vercel.com (ฟรี)
2. Push code ขึ้น GitHub
3. เชื่อม GitHub กับ Vercel
4. กด Deploy — ได้ URL ฟรี เช่น `https://cardmatch.vercel.app`

### Backend (Node.js) → Railway
1. สมัคร railway.app (ฟรี $5/เดือน)
2. New Project → Deploy from GitHub
3. เลือก folder `server/`
4. ตั้งค่า Environment Variables
5. ได้ URL เช่น `https://cardmatch-server.railway.app`

### Database → ไม่ต้องย้าย (ถ้าใช้ Railway)
Railway มี SQL Server หรือ PostgreSQL ให้ใช้ได้

---

## ตัวเลือกทดสอบด่วน (ไม่ถาวร)

### Cloudflare Quick Tunnel (ไม่ต้องสมัคร)
```bash
# ติดตั้ง cloudflared (ครั้งเดียว)
winget install --id Cloudflare.cloudflared

# รัน (หลังจาก server + client รันแล้ว)
node start-tunnel.js
```
ได้ URL เช่น `https://abc123.trycloudflare.com`
แชร์ให้ผู้เล่นได้เลย — URL เปลี่ยนทุกครั้ง

### ngrok (URL คงที่ ถ้าใช้แบบจ่ายเงิน)
```bash
npm install -g ngrok
ngrok config add-authtoken YOUR_TOKEN
ngrok http 3000
```

---

## สรุปแนะนำ

| วิธี | ค่าใช้จ่าย | ยากแค่ไหน | เหมาะกับ |
|---|---|---|---|
| Vercel + Railway | ฟรี | ปานกลาง | Production จริง |
| Cloudflare Tunnel | ฟรี | ง่าย | ทดสอบกับเพื่อน |
| ngrok | ฟรี/จ่าย | ง่าย | ทดสอบ + demo |
| LAN (ปัจจุบัน) | ฟรี | ง่าย | เฉพาะ WiFi เดียวกัน |
