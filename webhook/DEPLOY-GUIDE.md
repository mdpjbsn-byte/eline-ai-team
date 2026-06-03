# 🚀 คู่มือ deploy LINE webhook (ทีม AI ตอบใน LINE ได้)

โค้ดเขียนเสร็จแล้ว เหลือ 4 ขั้น — Jarvis ไกด์ทีละขั้น

## สิ่งที่ต้องมีก่อน (เจ้านายเตรียม)
1. **Claude API key** — จาก console.anthropic.com → เติมเครดิตขั้นต่ำ $5 (จ่ายตามใช้ ~หลักสิบสตางค์/ข้อความ)
2. **บัญชี Cloudflare** (ฟรี) — สมัครที่ dash.cloudflare.com
3. **LINE Developers** — มี channel อยู่แล้ว (ที่ส่ง notify ได้)

---

## ขั้นที่ 1 — ติดตั้งเครื่องมือ + login Cloudflare
```bash
cd /Users/moodang/Desktop/Eline/webhook
npx wrangler login          # เปิดเบราว์เซอร์ให้ login Cloudflare
```

## ขั้นที่ 2 — ใส่ความลับ (Secrets)
```bash
npx wrangler secret put LINE_TOKEN          # วาง LINE channel access token
npx wrangler secret put ANTHROPIC_API_KEY   # วาง Claude API key
```

## ขั้นที่ 3 — deploy
```bash
npx wrangler deploy
```
→ จะได้ URL เช่น `https://eline-line-webhook.xxx.workers.dev`

## ขั้นที่ 4 — ตั้ง Webhook URL ใน LINE
1. ไป LINE Developers Console → channel → Messaging API
2. ช่อง **Webhook URL** → วาง URL ที่ได้ + ต่อท้าย ไม่ต้อง (ใช้ URL ตรงๆ)
3. กด **Verify** → เปิด **Use webhook** = ON
4. ปิด "Auto-reply messages" (ไม่งั้นบอท default ตอบทับ)

---

## เสร็จแล้วทดสอบ
พิมพ์ใน LINE: "เฟ ช่วงนี้นอนไม่หลับ"
→ ควรได้คำตอบจากคุณหมอเฟ

---

## หมายเหตุความปลอดภัย
- Secrets เก็บใน Cloudflare ไม่อยู่ในโค้ด/GitHub ✅
- worker.js ขึ้น GitHub ได้ (ไม่มีรหัส)
