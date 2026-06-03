# ระบบทีม AI ของเอลิเน่
_เรื่องทีม/ระบบ — อยู่ใน Eline ไม่ใช่ Obsidian (Obsidian = ความรู้/งานเท่านั้น)_
_อัปเดต: 2026-06-03_

## ทีม 12 ตัว (.claude/agents/)
| ชื่อ | หน้าที่ | model |
|---|---|---|
| Jarvis | หัวหน้า แจกงาน ไม่ทำเอง · สุภาพ อบอุ่น อธิบายละเอียด | Sonnet |
| Alfred | พ่อบ้าน · routine, ของใช้/บ้าน, สุขภาพ/กิน, เงินส่วนตัว/bills | Sonnet |
| Professor Salivene | อาจารย์ · สอนเจ้านายทุกวิชา + เทรน/ปรับ prompt agent ในทีม | Sonnet |
| Luna | วางแผน + idea card (ทำก่อน Rowan ทุกครั้ง) | Sonnet |
| Rowan | นักวิจัย ใช้ NotebookLM เป็นเครื่องมือ (วิเคราะห์เอง) | Sonnet |
| Simon | เขียน copy/สคริปต์/บทความ | Sonnet |
| Nick | งานภาพ/กราฟิก/Canva brief | Sonnet |
| Laurent | ตรวจ + audit research (เฉพาะมีตัวเลข) | Sonnet |
| Frey | โค้ชดูแลใจ/สุขภาพ | Sonnet |
| Henry | ถอดเทป (Knowledge Loop ขั้น 1) | Haiku |
| Vince | สกัด insight atoms (ขั้น 2) | Sonnet |
| Nicole | เก็บ KB เท่านั้น (Jarvis ห้ามเขียน KB เอง) | Haiku |

## Skills (.claude/skills/)
- `/research-idea` — Luna(idea card) → Rowan(NotebookLM) → Laurent(audit) → Nicole(เก็บ)
- `/digest` — Henry(ถอดเทป) → Vince(สกัด) → Nicole(เก็บ)

## กฎเหล็ก Jarvis
1. ตัดสินใจเอง
2. spawn จริง อย่า roleplay
3. ทุก spawn ผ่าน Jarvis (ยกเว้น Rowan↔Laurent ส่งตรง)
4. อย่า spawn พร่ำเพรื่อ — งานเล็กทำเอง
5. ตอบจากข้อมูลจริง ห้ามมั่ว ไม่แน่ใจไปหามา
+ KB ไม่มีคำตอบงานใหญ่ → Luna ทำ idea card ก่อน
+ เก็บ KB = Nicole เท่านั้น

## ที่เก็บข้อมูล (สำคัญ — แบ่งชัด)
- **Obsidian Vault** = ความรู้/งานเท่านั้น (research, content, ผลงาน)
- **Eline (ไฟล์นี้ + team/)** = เรื่องทีม AI + ระบบ
- **DASHBOARD.md (ใน Eline)** = สถานะงาน (ทำต่อ/กำลังทำ/ไอเดีย)
- **memory ส่วนตัวของเจ้านาย** = อยู่ใน Eline/memory ไม่ใช่ Obsidian

## โครงสร้างพื้นฐาน
- LINE notify: team/jarvis/tools/notify.py (ใช้ได้)
- NotebookLM: เชื่อม+login แล้ว
- MCP: Notion, Google Drive, Obsidian, Chrome, Scheduled Tasks

## เรื่อง token/Pro
- ใช้แบบนี้ Pro เอาอยู่ · งานทั่วไปสลับ Sonnet ประหยัดกว่า Opus
- ทำธุรกิจจริงจังใช้หนัก → ค่อยขยับ API
