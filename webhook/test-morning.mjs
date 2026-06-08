// ระบบ "ซ้อม" บทสนทนาเช้า — รันในเครื่อง ไม่แตะ LINE/production
// ใช้ prompt + logic จริงจาก worker.js · state จำลองในหน่วยความจำ (แทน KV)
//
// วิธีใช้:
//   node test-morning.mjs                         → รันบทสนทนาตัวอย่าง
//   node test-morning.mjs "ตื่นแล้ว" "ไปทำงานครับ"   → ใส่คำตอบสมมติเอง (ทีละข้อความ)

import { readFileSync } from "node:fs";

// จำลองเวลาเป็น "จันทร์ 04:05 น." เพื่อให้บริบทเป็นเช้าจริง (worker อ่าน new Date())
const RealDate = Date;
const FAKE = new RealDate("2026-06-08T04:05:00+07:00"); // วันจันทร์ (วันทำงาน)
globalThis.Date = class extends RealDate {
  constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(FAKE); }
  static now() { return FAKE.getTime(); }
};

const { buildAlfredConvoPrompt, callClaude } = await import("./worker.js");

const secrets = readFileSync(new URL("../.secrets", import.meta.url), "utf8");
const ANTHROPIC_API_KEY = secrets.match(/ANTHROPIC_API_KEY=(.+)/)[1].trim();
const env = { ANTHROPIC_API_KEY };

const readLocal = (p) => { try { return readFileSync(new URL(p, import.meta.url), "utf8"); } catch { return ""; } };
const memory = {
  profile: readLocal("../memory/INTERVIEW-ANSWERS.md"),
  routine: readLocal("../memory/DAILY-ROUTINE.md"),
  dashboard: "",
};

// state จำลอง (แทน KV)
let state = {};
// จำลองวันหยุด/โน้ตปฏิทิน:  NOTE="ลากิจไปเที่ยว" node test-morning.mjs "ตื่นแล้ว"
const ctx = {
  preknownOff: process.env.OFF === "1" || !!process.env.NOTE,
  holidayNote: process.env.NOTE || "",
};
if (ctx.preknownOff) console.log(`(จำลอง: วันหยุด${ctx.holidayNote ? " — " + ctx.holidayNote : ""})`);

async function turn(userText) {
  const raw = await callClaude(buildAlfredConvoPrompt(memory, state, ctx), userText, env);
  let reply = raw, set = null;
  try {
    const j = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
    if (j.reply) reply = j.reply;
    if (j.set && typeof j.set === "object") set = j.set;
  } catch { /* parse ไม่ได้ → ใช้ raw */ }
  if (set && Object.keys(set).length) state = { ...state, ...set };
  console.log("\n────────────────────────────────────────");
  console.log("🧑 เจ้านาย:", userText);
  console.log("🤖 ตอบ   :", reply);
  console.log("📦 state  :", JSON.stringify(state));
}

const args = process.argv.slice(2);
const convo = args.length ? args : [
  "ตื่นแล้วครับ",
  "เช้านี้มีน้ำมูกนิดหน่อย ไอเบา ๆ",
  "วันนี้ไม่ไปทำงานครับ ป่วย",
];

console.log("=== ซ้อมบทสนทนาเช้า (จำลอง — ไม่ส่งจริง) ===");
for (const msg of convo) await turn(msg);
console.log("\n✅ จบการซ้อม");
