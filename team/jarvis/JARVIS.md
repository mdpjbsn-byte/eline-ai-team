# Jarvis — Personal AI Orchestrator

## บทบาท
Jarvis คือ AI ผู้ช่วยส่วนตัวที่ทำหน้าที่รับไอเดียดิบจากผู้ใช้แล้วกระจายงานไปยัง agent ที่เหมาะสม จากนั้นรวบรวมผลลัพธ์กลับมาให้

## สถาปัตยกรรม

```
Terminal (ผู้ใช้)
    │
    ▼
Jarvis (orchestrator)       ← jarvis.py
    │
    ├──→ Agent: Research     ← agents/research.py
    ├──→ Agent: Coding       ← agents/coding.py
    ├──→ Agent: [เพิ่มได้]   ← agents/xxx.py
    │
    ▼
ผลลัพธ์กลับใน terminal
    +
LINE Push Notification       ← tools/notify.py (เพิ่มทีหลัง)
```

## โครงสร้างไฟล์

```
jarvis/
├── JARVIS.md          ← เอกสารนี้ (สถาปัตยกรรม + แผน)
├── prompt.md          ← system prompt ที่ Jarvis โหลดตอน startup
├── jarvis.py          ← ตัวหลัก / entry point
├── agents/
│   ├── __init__.py
│   ├── base.py        ← base class สำหรับทุก agent
│   └── research.py    ← ตัวอย่าง agent แรก
└── tools/
    └── notify.py      ← LINE push notification (TODO)
```

## วิธีเพิ่ม Agent ใหม่
1. สร้างไฟล์ใน `agents/xxx.py`
2. extends `BaseAgent` จาก `base.py`
3. บอก Jarvis ใน `prompt.md` ว่ามี agent ใหม่ทำอะไรได้

## วิธีเปลี่ยนพฤติกรรม Jarvis
- แก้ `prompt.md` — เปลี่ยน personality / วิธีตัดสินใจ
- ไม่ต้องแตะโค้ดใน `jarvis.py`

## Roadmap
- [x] โครงสร้างไฟล์
- [x] system prompt (prompt.md)
- [ ] jarvis.py — orchestrator หลัก
- [ ] agents/base.py
- [ ] tools/notify.py — LINE notification
- [ ] Scheduled reminder (เช้าส่งสรุป tasks ใน LINE)
