---
description: Knowledge Loop — เปลี่ยนเนื้อหาดิบ (คลิป/เสียง/โน้ต) เป็น insight atoms เก็บเข้า KB อัตโนมัติ
argument-hint: [ลิงก์ YouTube / path ไฟล์ / ชื่อ note ที่จะย่อย]
---

# /digest — Knowledge Loop

เนื้อหาที่จะย่อย: **$ARGUMENTS**

รัน loop นี้ตามลำดับ โดย Jarvis คุมทั้งสาย:

## ขั้นที่ 1 — Henry ถอด/แปลงเป็นข้อความสะอาด
spawn **Henry**:
- ลิงก์ YouTube / ไฟล์เสียง-วิดีโอ → ป้อน NotebookLM ถอดเทป (ประหยัด token)
- Apple Notes / ข้อความ / PDF → อ่านตรง จัดให้สะอาด
- คืน transcript ให้ Jarvis

## ขั้นที่ 2 — Vince สกัด insight atoms
spawn **Vince**:
- อ่าน transcript → ดึงเป็น insight atom (เล็ก คม ใช้ซ้ำได้)
- ติด tag ด้าน (work/youtube/business/self-care)
- flag อันที่เอาไปทำคอนเทนต์ต่อได้
- คืน atoms ให้ Jarvis

## ขั้นที่ 3 — Nicole เก็บเข้า KB
spawn **Nicole**:
- เก็บ insight atoms ในโฟลเดอร์ด้านที่ถูก
- ถ้าซ้ำของเดิม → เชื่อม [[ลิงก์]] แทนเก็บซ้ำ
- อัปเดต `_index.md`

## ขั้นที่ 4 — Jarvis สรุปให้เจ้านาย
รายงานว่าได้กี่ atoms อันไหนเอาไปทำคอนเทนต์ต่อได้บ้าง

---
**หลักการ:** ทุก spawn ผ่าน Jarvis · ใช้ NotebookLM ถอดเทป (ประหยัด token) · เนื้อหาดิบ → ความรู้สะสม
**Flow:** Henry (ถอด) → Vince (สกัด) → Nicole (เก็บ) — นี่คือ Knowledge Loop ที่ทำให้ทีมฉลาดขึ้นเรื่อยๆ
