# ระบบทีม AI ของเอลิเน่
_เรื่องทีม/ระบบ — อยู่ใน Eline ไม่ใช่ Obsidian (Obsidian = ความรู้/งานเท่านั้น)_
_อัปเดต: 2026-06-03_

## ทีม 23 ตัว (.claude/agents/)

### 🏢 Work Team

### 🏢 Work Team
| ชื่อ | หน้าที่ | model |
|---|---|---|
| Jarvis | หัวหน้า แจกงาน ไม่ทำเอง · สุภาพ อบอุ่น อธิบายละเอียด | Sonnet |
| Luna | วางแผน + idea card (ทำก่อน Rowan ทุกครั้ง) | Sonnet |
| Rowan | นักวิจัย ใช้ NotebookLM เป็นเครื่องมือ (วิเคราะห์เอง) | Sonnet |
| Simon | เขียน copy/สคริปต์/บทความ | Sonnet |
| Nick | งานภาพ/กราฟิก/Canva brief | Sonnet |
| Lauren | ตรวจ + audit research (เฉพาะมีตัวเลข) | Sonnet |
| Oliver | นักวิเคราะห์ตัวเลขธุรกิจ · P&L, YouTube, คู่แข่ง/ตลาด | Sonnet |
| Henry | ถอดเทป (Knowledge Loop ขั้น 1) | Haiku |
| Vince | สกัด insight atoms (ขั้น 2) | Sonnet |
| Nicole | เก็บ KB เท่านั้น (Jarvis ห้ามเขียน KB เอง) | Haiku |
| Professor Salevan | อาจารย์ · สอนเจ้านายทุกวิชา + เทรน/ปรับ prompt agent ในทีม | Sonnet |
| Sir Edmund | ทนายประจำตระกูล · สัญญา กฎหมายธุรกิจ ลิขสิทธิ์ PDPA ทรัพย์สิน | Sonnet |
| James | นักข่าว · Daily briefing ข่าวเทค/AI/ธุรกิจ/การเงิน | Sonnet |
| Rex | หัวหน้าความปลอดภัยดิจิทัล · Anti-scam, Cyber, ตรวจสอบ | Sonnet |

### 🏠 Life Team
| ชื่อ | หน้าที่ | model |
|---|---|---|
| Alfred | หัวหน้า Life Team · ดูภาพรวมชีวิต แนะนำ เตือน | Sonnet |
| Lisa | แม่บ้านปฏิบัติการ · สต็อกของ, ตารางทำความสะอาด, checklist บ้าน | Sonnet |
| Emma | นักบัญชี · รับสลิป, บันทึกรายรับ-รายจ่าย, ติดตาม bills | Sonnet |
| Frey | ดูแลสุขภาพกาย-ใจ · ออกกำลังกาย · การนอน · อารมณ์ | Sonnet |
| Chef Red | อดีตเชฟ 5 ดาว · เมนูอาหาร, โภชนาการ, ประสานกับ Frey | Sonnet |
| Lilly | โคชบุคลิกภาพ · สไตล์, แฟชั่น, femininity, การเข้าสังคม | Sonnet |
| Dr. Glen | สัตวแพทย์ · ดูแล Polar (ปอม) และ ชูว์ครีม (แฮมสเตอร์ไจแอนท์) | Sonnet |
| Gilbert | คนสวน · ออกแบบแปลงผัก สมุนไพร ดูแลต้นไม้ ประสาน Chef Red | Sonnet |

### ⚡ Independent
| ชื่อ | หน้าที่ | model |
|---|---|---|
| Orius | พ่อมดขาว · คำถามใหญ่ชีวิต ปัญญา มุมมอง ทางแยก | Sonnet |

## Skills (.claude/skills/)
- `/research-idea` — Luna(idea card) → Rowan(NotebookLM) → Lauren(audit) → Nicole(เก็บ)
- `/digest` — Henry(ถอดเทป) → Vince(สกัด) → Nicole(เก็บ)

## กฎเหล็ก Jarvis
1. ตัดสินใจเอง
2. spawn จริง อย่า roleplay
3. ทุก spawn ผ่าน Jarvis (ยกเว้น Rowan↔Lauren ส่งตรง)
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
