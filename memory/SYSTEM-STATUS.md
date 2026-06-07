---
name: system-status
description: สถานะระบบ Cloudflare Worker + LINE webhook + ความเชื่อมโยงข้อมูลระหว่าง LINE และ KB
metadata:
  type: project
  updated: 2026-06-07
---

# ระบบ LINE Webhook — สถานะและสถาปัตยกรรม

## Architecture

```
เจ้านายพิมพ์ใน LINE
        ↓
LINE Platform → Cloudflare Worker (webhook/worker.js)
        ↓
Worker อ่านความจำจาก GitHub repo (mdpjbsn-byte/eline-ai-team)
  - memory/INTERVIEW-ANSWERS.md
  - memory/DAILY-ROUTINE.md
  - DASHBOARD.md
        ↓
Claude API (Haiku) → Alfred / Jarvis / Arena / Frey ตอบ
        ↓
Nicole วิเคราะห์บทสนทนา → เขียนกลับ GitHub อัตโนมัติ
  - งานมีวันกำหนด → Notion
  - งาน/reminder ทั่วไป → ALFRED-TASKS.md หรือ DASHBOARD.md
```

## Morning Brief Schedule (Cron ทุก 30 นาที — worker เช็คเวลาเอง)

| เวลา | ฟังก์ชัน | ช่อง LINE |
|------|---------|-----------|
| 04:00 | Alfred ปลุกตื่น + routine เช้า | Alfred |
| 04:35 | Frey เช็คสุขภาพ | Alfred |
| 06:30 weekday | Alfred เช็ค traffic + ก่อนออกบ้าน | Alfred |
| 06:30 weekend | Weekend brief (ไม่มี traffic) | Alfred |
| 08:00 weekday | James ข่าว + Jarvis morning brief | Alfred + Jarvis |
| 08:00 weekend | James ข่าว | Alfred |
| 12:00 weekday | Alfred เช็คกลางวัน | Alfred |
| 12:00 weekend | เช็คกลางวัน + meal prep | Alfred |
| 17:30 weekday | Alfred preview งานคืนนี้ | Alfred |
| 20:30 | Evening brief + Frey checklist | Alfred |
| 20:55 | Alfred เตรียมนอน | Alfred |

## สถานะปัจจุบัน (2026-06-07)

## James Morning Brief — Spec (อัปเดต 2026-06-07 รอบ 2)

**Source: Bloomberg RSS** (ฟรี ไม่ต้อง API key ทำงานบน Cloudflare ได้)
- feeds: markets, economics, technology, politics (`feeds.bloomberg.com/<หมวด>/news.rss`)
- กรองข่าว 24 ชม.ล่าสุด → Haiku คัด 6-10 ข่าวเด่น เขียนสรุปไทย (อิงเนื้อจริง ห้ามแต่ง)
- **เขียนลง Notion** หน้าใหม่รายวัน (parent page "ตารางงาน Eliné" = `378477bd-95b9-81dd-9177-c145469f54be`) พร้อมลิงก์ต้นทาง Bloomberg
- **LINE ส่งแค่ hook** หัวข้อข่าว + ลิงก์เปิด Notion (ส่งช่อง Alfred)
- trigger: cron 08:00 หรือพิมพ์ "ข่าวเช้า" ใน LINE
- functions ใน worker.js: `NEWS_FEEDS`, `parseRSSItems`, `fetchFeed`, `callClaudeNews`, `createNewsNotionPage`, `sendNewsAlert`

**ประวัติที่ลองแล้วไม่เวิร์ค (อย่ากลับไปใช้):**
- ❌ NewsAPI.org — บล็อก server/Cloudflare (403 disallowed) free tier ใช้ได้แค่ localhost
- ❌ GNews — ทำงานได้แต่ข่าวคุณภาพต่ำ ไม่ใช่ Bloomberg/Reuters จริง

**Phase 2 (หลัง Arena interview):** เพิ่มติดตามพอร์ต/หุ้นส่วนตัว
**หมายเหตุ:** เปิดลิงก์ Notion ใน LINE in-app browser ไม่ได้ (Google บล็อก login) — ต้องเปิดใน Safari/แอป Notion

---

| รายการ | สถานะ |
|--------|--------|
| worker.js | ✅ เขียนเสร็จแล้ว |
| wrangler.toml | ✅ ตั้งค่าแล้ว |
| DEPLOY-GUIDE.md | ✅ มีคู่มือครบ |
| GitHub repo เชื่อมแล้ว | ✅ mdpjbsn-byte/eline-ai-team |
| Deploy ขึ้น Cloudflare | ✅ Deploy แล้ว ใช้งานได้ |
| ตั้ง Secrets ใน Cloudflare | ✅ ตั้งแล้ว |
| ตั้ง Webhook URL ใน LINE | ✅ เชื่อมแล้ว ทดสอบผ่าน |
| Push memory/ ขึ้น GitHub | ⚠️ ไฟล์ใหม่จาก session 2026-06-07 ยังไม่ได้ push |

## Secrets ที่ต้องตั้งใน Cloudflare

| Secret | มาจากไหน |
|--------|----------|
| LINE_TOKEN | LINE Developers → Jarvis channel → Channel access token |
| LINE_TOKEN_ALFRED | LINE Developers → Alfred channel → Channel access token |
| LINE_SECRET | LINE Developers → channel secret |
| LINE_USER_ID | LINE Developers → User ID ของเจ้านาย |
| ANTHROPIC_API_KEY | console.anthropic.com |
| GITHUB_TOKEN | GitHub → Settings → Personal Access Tokens (repo scope) |
| NOTION_TOKEN | Notion → Integration token |
| NOTION_DB_ID | Notion database ID ที่เก็บ tasks |
| HOME_COORDS | lat,lng บ้านเจ้านาย (สำหรับ traffic check) |
| WORK_COORDS | lat,lng ที่ทำงาน |
| GOOGLE_MAPS_KEY | Google Cloud Console → Routes API |

## ขั้นตอนที่ต้องทำก่อน LINE จะใช้งานได้

### ⚠️ สิ่งที่ต้องทำทันที — Push memory ขึ้น GitHub
ไฟล์ใหม่จาก session 2026-06-07 ยังไม่ขึ้น GitHub Alfred/Jarvis ใน LINE อ่านไม่เห็น:
- INTERVIEW-ANSWERS.md (ข้อมูลตัวตนเจ้านายทั้งหมด)
- DAILY-ROUTINE.md
- STYLE/FINANCE/WEALTH/HEALTH/FOOD/PET-INTERVIEW.md

```bash
cd /Users/moodang/Desktop/Eline
git add memory/
git commit -m "Add life discovery memory files"
git push origin main
```

## วิธีซิงค์ข้อมูลระหว่าง LINE ↔ Local

- **Local → LINE**: `git push` แล้ว worker จะอ่านจาก GitHub อัตโนมัติ
- **LINE → Local**: Nicole เขียนกลับ GitHub อัตโนมัติ → ต้อง `git pull` เพื่อดึงมาที่เครื่อง

**Why:** Worker อ่าน/เขียนจาก GitHub repo โดยตรง ไม่ใช่ local files
**How to apply:** ทุกครั้งที่อัปเดต memory ไฟล์ใหม่ต้อง push ขึ้น GitHub ด้วย
