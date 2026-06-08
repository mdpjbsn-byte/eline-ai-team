/**
 * Eliné LINE Webhook — Cloudflare Worker
 * สอง Channel: Jarvis (งาน) + Alfred (ชีวิตส่วนตัว)
 * Nicole เก็บข้อมูลหลังบ้านอัตโนมัติ
 */

const GITHUB_REPO = "mdpjbsn-byte/eline-ai-team";
const ALFRED_BOT_USER_ID = "U7e97b1ba9efbfb15bc409e04ecb938f9";

// โมเดล: บทสนทนา/ข้อความถึงเจ้านาย ใช้ Sonnet (ภาษาเป็นธรรมชาติ) — งานเบื้องหลังใช้ Haiku (ถูก+เร็ว)
const MODEL_CHAT = "claude-sonnet-4-6";
const MODEL_UTIL = "claude-haiku-4-5-20251001";

// สไตล์การพิมพ์ใน LINE — แนบเข้าทุก prompt ที่ส่งหาเจ้านาย
const LINE_STYLE = `
=== วิธีพิมพ์ใน LINE (สำคัญมาก) ===
- ห้ามใช้ markdown เด็ดขาด: ห้าม ** **, ห้าม #, ห้าม - หรือ * นำหน้าหัวข้อ เพราะ LINE ไม่แปลงให้ จะโชว์สัญลักษณ์ดิบ ๆ อ่านแล้วเหมือนหุ่นยนต์
- อยากเน้นหรือแยกหัวข้อ ให้ขึ้นบรรทัดใหม่เอา ไม่ใช่ทำตัวหนา
- น้ำเสียงแบบบัตเลอร์ผู้ใหญ่: สุภาพ นิ่ง มีระดับ น่าเชื่อถือ — พูดเท่าที่ควรพูด
- ห้ามเวิ่นเว้อ ห้ามขยายความเกินจำเป็น ห้ามหวานเลี่ยน ห้ามประจบ ตรงประเด็นเสมอ
- emoji ใช้ได้มากสุด 1 ตัวต่อข้อความ หรือไม่ใช้เลยก็ได้
- กระชับ ได้ใจความ จบเร็ว`;

async function fetchGitHubFile(path, env) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    headers: {
      "Authorization": `token ${env.GITHUB_TOKEN}`,
      "User-Agent": "Eline-LINE-Bot",
      "Accept": "application/vnd.github.v3.raw",
    },
  });
  if (!res.ok) return "";
  return await res.text();
}

async function updateGitHubFile(path, newContent, env) {
  // ดึง SHA เดิมก่อน
  const metaRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    headers: {
      "Authorization": `token ${env.GITHUB_TOKEN}`,
      "User-Agent": "Eline-LINE-Bot",
    },
  });
  if (!metaRes.ok) return;
  const meta = await metaRes.json();

  await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    method: "PUT",
    headers: {
      "Authorization": `token ${env.GITHUB_TOKEN}`,
      "User-Agent": "Eline-LINE-Bot",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "Nicole: auto-update from LINE",
      sha: meta.sha,
      content: btoa(unescape(encodeURIComponent(newContent))),
    }),
  });
}

// ดึง tasks จาก Notion วันนี้และวันพรุ่งนี้
async function fetchNotionTasks(env) {
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fmt = d => d.toISOString().split("T")[0];

    const res = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DB_ID}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Due date", date: { on_or_after: fmt(today) } },
            { property: "Due date", date: { on_or_before: fmt(tomorrow) } },
          ]
        },
        sorts: [{ property: "Due date", direction: "ascending" }],
      }),
    });
    const data = await res.json();
    const pages = data.results || [];
    if (pages.length === 0) return "ไม่มีนัดหมายหรืองานวันนี้และพรุ่งนี้";
    return pages.map(p => {
      const name = p.properties["Task name"]?.title?.[0]?.plain_text || "ไม่มีชื่อ";
      const date = p.properties["Due date"]?.date?.start || "";
      const status = p.properties["Status"]?.status?.name || "";
      return `- ${name} (${date}) [${status}]`;
    }).join("\n");
  } catch (e) {
    return "ไม่สามารถดึงข้อมูลจาก Notion ได้";
  }
}

// ===== State รายวัน (เก็บใน KV) — จำบทสนทนาเช้าทั้งวัน =====
function bangkokDateKey() {
  // YYYY-MM-DD ตามเวลาไทย
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}
async function getDayState(env) {
  if (!env.STATE) return {};
  try {
    const raw = await env.STATE.get(`day:${bangkokDateKey()}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
async function setDayState(env, patch) {
  if (!env.STATE) return patch;
  const next = { ...(await getDayState(env)), ...patch };
  // เก็บ 2 วัน (กันค้างข้ามคืน) แล้วหมดอายุเอง
  await env.STATE.put(`day:${bangkokDateKey()}`, JSON.stringify(next), { expirationTtl: 172800 });
  return next;
}

// วันหยุด: อ่านจากไฟล์ webhook/holidays.txt (YYYY-MM-DD [โน้ต], # คือคอมเมนต์)
// คืน "" ถ้าไม่ใช่วันหยุด · คืนโน้ต (หรือ "หยุด") ถ้าเป็นวันหยุด
async function holidayNoteToday(env) {
  try {
    const txt = await fetchGitHubFile("webhook/holidays.txt", env);
    const today = bangkokDateKey();
    for (const line of txt.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.startsWith(today)) continue;
      return t.slice(today.length).trim() || "วันหยุด";
    }
  } catch (e) { /* ignore */ }
  return "";
}
async function isHolidayToday(env) {
  return (await holidayNoteToday(env)) !== "";
}

// สวิตช์เดียวคุมทั้งวัน: เสาร์/อาทิตย์ หรือ วันหยุดในไฟล์ หรือ เจ้านายบอกว่าไม่ไป = ไม่ใช่วันทำงาน
async function isWorkdayToday(env) {
  const wd = new Date().toLocaleString("en-US", { weekday: "short", timeZone: "Asia/Bangkok" });
  if (wd === "Sat" || wd === "Sun") return false;
  if (await isHolidayToday(env)) return false;
  const st = await getDayState(env);
  if (st.goingToWork === false || st.goingToWork === "false") return false;
  return true;
}

async function buildMemory(env, isAlfred) {
  if (isAlfred) {
    const [profile, routine, notionTasks] = await Promise.all([
      fetchGitHubFile("memory/INTERVIEW-ANSWERS.md", env),
      fetchGitHubFile("memory/DAILY-ROUTINE.md", env),
      fetchNotionTasks(env),
    ]);
    return { profile, routine, dashboard: notionTasks };
  } else {
    const [profile, dashboard] = await Promise.all([
      fetchGitHubFile("memory/INTERVIEW-ANSWERS.md", env),
      fetchGitHubFile("DASHBOARD.md", env),
    ]);
    return { profile, routine: "", dashboard };
  }
}

function buildJarvisPrompt(memory) {
  return `คุณคือทีม AI ฝั่งงานของเจ้านาย (เอลิเน่) ตอบผ่าน LINE Channel "Jarvis"
ภาษาไทย · กระชับ อ่านง่าย

กฎเหล็ก: ขึ้นต้นด้วยชื่อตัวเองเสมอ ใช้คำลงท้ายให้ถูกต้องตลอด ห้ามปนกัน

ดูเรื่องที่พูด แล้วตอบด้วยเสียงของคนที่เหมาะ:
- งาน/ธุรกิจ/วางแผน → 🎯 Jarvis — เรียกว่า "เจ้านาย" · ลงท้าย "ครับ" ทุกประโยค (ผู้ชาย)
- การเงิน/ลงทุน/พอร์ต → 💼 Arena — เรียกว่า "เจ้านาย" · ลงท้าย "ค่ะ" ทุกประโยค (ผู้หญิง)

=== ข้อมูลเจ้านาย ===
${memory.profile ? memory.profile.substring(0, 3000) : "ไม่มีข้อมูล"}

=== Dashboard / งานค้าง ===
${memory.dashboard ? memory.dashboard.substring(0, 1500) : "ไม่มีข้อมูล"}
${LINE_STYLE}`;
}

export function buildAlfredPrompt(memory) {
  const now = new Date();
  const timeStr = now.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hour = now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Bangkok" });
  const greeting = hour < 12 ? "อรุณสวัสดิ์" : hour < 17 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น";
  return `คุณคือ Alfred พูดสุภาพ กระชับ เป็นธรรมชาติ เรียกผู้ใช้ว่า "คุณท่าน" เท่านั้น ห้ามใช้ "เจ้านาย" แทนตัวเองว่า "ผม" ลงท้าย "ครับ"
ตอนนี้: ${dateStr} เวลา ${timeStr} น.

กฎเหล็ก:
- ห้ามทักทาย "สวัสดี" หรือ "${greeting}" ทุกข้อความ — ทักเฉพาะตอนที่คุณท่านทักมาก่อนเท่านั้น
- ห้ามสร้างหรือเดา task/งาน/นัดหมายที่ไม่มีในข้อมูลด้านล่างเด็ดขาด — ถ้าไม่มีให้บอกว่า "ไม่พบรายการครับ"
- ตอบตรงประเด็น ไม่ต้องขึ้นต้นชื่อตัวเองทุกครั้ง

ดูเรื่องที่พูด แล้วตอบด้วยเสียงของคนที่เหมาะ:
- ทั่วไป/routine/บ้าน/กิน → Alfred
- สุขภาพ/เครียด/เหนื่อย/อารมณ์ → 🩺 Dr. Frey — เรียกว่า "เจ้านาย" · ลงท้าย "ค่ะ" เท่านั้น (ผู้หญิง ห้ามใช้ "ครับ")

=== ข้อมูลเจ้านาย ===
${memory.profile ? memory.profile.substring(0, 3000) : "ไม่มีข้อมูล"}

=== Routine ปัจจุบัน ===
${memory.routine ? memory.routine.substring(0, 1500) : "ไม่มีข้อมูล"}

=== งานที่ Alfred ดูแล ===
${memory.dashboard ? memory.dashboard.substring(0, 1000) : "ไม่มีรายการ"}
${LINE_STYLE}`;
}

// Nicole เขียนลง Notion
async function writeToNotion(taskName, dateStr, category, env) {
  try {
    const properties = {
      "Task name": { title: [{ type: "text", text: { content: taskName } }] },
      "Status": { status: { name: "Not started" } },
    };
    if (dateStr) properties["Due date"] = { date: { start: dateStr } };

    await fetch(`https://api.notion.com/v1/pages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: env.NOTION_DB_ID },
        properties,
      }),
    });
  } catch (e) {}
}

// Nicole — วิเคราะห์บทสนทนาแล้วอัพเดทไฟล์และ Notion ถ้าจำเป็น
async function runNicole(userText, agentReply, isAlfred, env) {
  const targetFile = isAlfred ? "memory/ALFRED-TASKS.md" : "DASHBOARD.md";
  const currentContent = await fetchGitHubFile(targetFile, env);
  const today = new Date().toISOString().split("T")[0];

  const nicolePrompt = `คุณคือ Nicole บรรณารักษ์ของทีม วิเคราะห์บทสนทนาแล้วตัดสินว่ามีอะไรต้องเก็บ

บทสนทนา:
ผู้ใช้: ${userText}
Agent: ${agentReply}

วันนี้: ${today}

ตอบ JSON รูปแบบนี้เท่านั้น:
{
  "notion_task": null หรือ {"name": "ชื่องาน", "date": "YYYY-MM-DD หรือ null", "category": "นัดหมาย/งานธุรกิจ/YouTube/MBA/ชีวิตส่วนตัว/สุขภาพ"},
  "github_update": null หรือ "เนื้อหาไฟล์ทั้งหมดที่อัพเดท"
}

กฎ:
- notion_task = ถ้ามีนัดหมายหรืองานที่มีวันชัดเจน
- github_update = ถ้ามีงาน/reminder ที่ไม่มีวันหรือเป็น task ทั่วไป
- ถ้าไม่มีอะไรต้องเก็บ ให้ทั้งสองเป็น null
- ไม่เก็บบทสนทนาทั่วไป

เนื้อหา ${targetFile} ปัจจุบัน:
${currentContent.substring(0, 1500)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_UTIL,
      max_tokens: 1500,
      messages: [{ role: "user", content: nicolePrompt }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    const result = JSON.parse(jsonMatch[0]);
    if (result.notion_task) {
      const { name, date, category } = result.notion_task;
      await writeToNotion(name, date, category, env);
    }
    if (result.github_update) {
      await updateGitHubFile(targetFile, result.github_update, env);
    }
  } catch (e) {}
}

export async function callClaude(systemPrompt, userText, env) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_CHAT,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userText }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "ขออภัยครับ ตอบไม่ได้ตอนนี้";
}

async function pushLine(text, token, userId) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ to: userId, messages: [{ type: "text", text }] }),
      });
      if (res.ok) return;
      console.error(`LINE push failed (attempt ${attempt}):`, res.status, (await res.text()).slice(0, 200));
    } catch (e) {
      console.error(`LINE push error (attempt ${attempt}):`, e);
    }
  }
}

async function replyLine(replyToken, text, token) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

// ===== บทสนทนาเช้าแบบโต้ตอบ (ฝั่ง Alfred) — รู้บริบทวันนี้ + เก็บ state =====
export function buildAlfredConvoPrompt(memory, state, ctx = {}) {
  const { preknownOff = false, holidayNote = "" } = ctx;
  return `${buildAlfredPrompt(memory)}

=== โหมดบทสนทนา (สำคัญ) ===
นี่คือการตอบข้อความที่เจ้านายพิมพ์เข้ามา
สถานะที่จำไว้ของวันนี้: ${JSON.stringify(state)}
วันนี้เป็นวันหยุดที่รู้ล่วงหน้า (เสาร์/อาทิตย์ หรือวันหยุดในปฏิทิน): ${preknownOff ? "ใช่" : "ไม่ใช่"}${holidayNote ? `\nบันทึกในปฏิทินวันนี้: ${holidayNote}` : ""}

วิธีปฏิบัติ:
1. ถ้าเจ้านายบอกว่าตื่น/เพิ่งตื่น (ช่วงเช้า) → ทักว่า "อรุณสวัสดิ์ครับ" (ห้ามใช้ "ตื่นได้ดี") — ข้อนี้ทับกฎห้ามทักทายด้านบน
2. เรื่องไปทำงาน:
   - ถ้า "ไม่ใช่วันหยุดที่รู้ล่วงหน้า" และยังไม่รู้คำตอบ (goingToWork ว่าง และ workAsked ไม่ใช่ true) → ถามท้ายข้อความสั้น ๆ "วันนี้เจ้านายไปทำงานตามปกติไหมครับ" (ถามครั้งเดียว ไม่ถามซ้ำ)
   - ถ้า "เป็นวันหยุดที่รู้ล่วงหน้า" → ห้ามถามเรื่องไปทำงานเด็ดขาด ให้ทักตามบริบทแทน: ถ้ามีบันทึกในปฏิทินให้พูดถึงตรง ๆ เช่น "วันนี้คุณท่าน<บันทึก> ขอให้สนุก/พักเต็มที่นะครับ" ถ้าเป็นเสาร์อาทิตย์ก็ทักวันหยุดสบาย ๆ
3. ถ้าเจ้านายตอบว่า "ไป" → รับทราบสั้น ๆ ชวนเข้า Golden Time นั่งสมาธิตาม routine เช้า (พูดถึง Golden Time/สมาธิ ตรง ๆ) (set goingToWork=true)
4. ถ้าเจ้านายตอบว่า "ไม่ไป":
   - ถ้าเพราะป่วย/ไม่สบาย → ให้ Dr. Frey เข้ามาดูแลทันที (set goingToWork=false, reason)
   - ถ้าไม่ใช่เพราะป่วย (พักผ่อน/ทำกิจกรรมอื่น/เคลียร์งาน) → Alfred รับทราบสั้น ๆ แล้ว "ถาม" ว่า "ให้ผมตามหมอเฟรมาดูแลไหมครับ" (set goingToWork=false, reason, freyOffered=true) — อย่าตามหมอเอง รอเจ้านายตอบรับก่อน ถ้าเจ้านายตอบรับค่อยให้ Frey เข้ามาในเทิร์นถัดไป ถ้าปฏิเสธก็จบ
5. เมื่อ Dr. Frey เป็นคนพูด → เปิดประโยคแรกด้วย "หมอเฟรค่ะ" เสมอ ให้รู้ว่าเปลี่ยนคนพูด · ผู้หญิง ลงท้าย "ค่ะ" ทุกประโยค ห้ามใช้ "ครับ"

ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON:
{"reply": "<ข้อความส่งเข้า LINE — ทำตามสไตล์การพิมพ์ข้างบนเคร่งครัด>", "set": {<อัปเดตเฉพาะที่เปลี่ยน เช่น "goingToWork": true หรือ false, "reason": "ป่วย/อื่น ๆ", "symptoms": "...", "workAsked": true — ถ้าไม่มีอะไรเปลี่ยนใส่ {}>}}`;
}

async function alfredConversationReply(userText, env) {
  const memory = await buildMemory(env, true);
  const state = await getDayState(env);
  const wd = new Date().toLocaleString("en-US", { weekday: "short", timeZone: "Asia/Bangkok" });
  const holidayNote = await holidayNoteToday(env);
  const preknownOff = wd === "Sat" || wd === "Sun" || holidayNote !== "";
  const raw = await callClaude(buildAlfredConvoPrompt(memory, state, { preknownOff, holidayNote }), userText, env);
  let reply = raw, set = null;
  try {
    const j = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
    if (j.reply) reply = j.reply;
    if (j.set && typeof j.set === "object") set = j.set;
  } catch (e) { /* parse ไม่ได้ → ใช้ raw เป็นคำตอบ ไม่อัปเดต state */ }
  if (set && Object.keys(set).length) await setDayState(env, set);
  return reply;
}

async function processEvents(events, destination, env) {
  const isAlfred = destination === ALFRED_BOT_USER_ID;
  const token = isAlfred ? env.LINE_TOKEN_ALFRED : env.LINE_TOKEN;
  // Jarvis สร้าง systemPrompt ที่นี่ · Alfred สร้างเองใน alfredConversationReply (รู้ state ด้วย)
  const systemPrompt = isAlfred ? null : buildJarvisPrompt(await buildMemory(env, false));

  for (const ev of events) {
    if (ev.type === "message" && ev.message?.type === "text") {
      const userText = ev.message.text;
      try {
        if (userText.trim() === "ข่าวเช้า") {
          await replyLine(ev.replyToken, "รอสักครู่นะครับ James กำลังดึงข่าว... 📰", token);
          await sendNewsAlert(env);
          continue;
        }
        // Alfred = บทสนทนาแบบรู้บริบทวันนี้ + เก็บ state · Jarvis = ตอบปกติ
        const reply = isAlfred
          ? await alfredConversationReply(userText, env)
          : await callClaude(systemPrompt, userText, env);
        await replyLine(ev.replyToken, reply, token);
        // Nicole เก็บข้อมูลหลังบ้าน
        await runNicole(userText, reply, isAlfred, env);
      } catch (e) {
        await replyLine(ev.replyToken, "ขออภัยครับ ระบบขัดข้องชั่วคราว 🙏", token);
      }
    }
  }
}

function thaiDateTime(now) {
  const day = now.toLocaleDateString("th-TH", { weekday: "long", timeZone: "Asia/Bangkok" });
  const date = now.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
  return `${day} ${date}`;
}

async function alfredSend(promptText, env) {
  const memory = await buildMemory(env, true);
  const system = buildAlfredPrompt(memory);
  const text = await callClaude(system, promptText, env);
  await pushLine(text, env.LINE_TOKEN_ALFRED, env.LINE_USER_ID);
}

// 04:00 — ปลุกตื่น + routine เช้า
async function sendMorningWakeup(env) {
  const dt = thaiDateTime(new Date());
  await alfredSend(`ส่ง morning wake-up วันนี้ (${dt}) กระชับ emoji ทักตื่นนอน + routine เช้าสั้นๆ + กำลังใจ 1 ประโยค ไม่ต้องพูดเรื่องงาน`, env);
}

// 04:35 — Frey เช็คอาการหลัง Golden
async function sendFreyMorningCheck(env) {
  const freyPrompt = `คุณคือ Dr. Frey แพทย์ดูแลสุขภาพส่วนตัว ผู้หญิง อบอุ่น ห่วงใย เรียกผู้ใช้ว่า "เจ้านาย" ลงท้าย "ค่ะ" ทุกประโยค ห้ามใช้ "ครับ"
ส่ง morning health check หลัง Golden Time กระชับ อ่านง่าย
ถามอาการสุขภาพเช้า: รู้สึกยังไงบ้าง มีน้ำมูก ไอ หรือแน่นหน้าอกไหม + แนะนำเครื่องดื่มตามอาการ (น้ำอุ่น ขิง มะนาวผึ้ง)
ถ้าเจ้านายตอบกลับว่ามีอาการ Alfred จะส่งรายงานให้ Frey ประเมินอีกครั้ง
${LINE_STYLE}`;
  const text = await callClaude(freyPrompt, "ส่ง morning health check หลัง Golden Time", env);
  await pushLine(text, env.LINE_TOKEN_ALFRED, env.LINE_USER_ID);
}

// 06:00 — พาโพล่าออกไปเดินเล่นข้างนอก
async function sendWalkPolar(env) {
  await alfredSend(`ได้เวลาพาโพล่าออกไปเดินเล่นข้างนอกแล้วครับ ประมาณ 15 นาที แสงแดดเช้าช่วยตั้งนาฬิกาชีวภาพให้สดชื่นทั้งวัน ทักสั้น ๆ อบอุ่น 1-2 ประโยค`, env);
}

// 06:15 — กลับบ้าน ให้อาหารโพล่า + อาบน้ำ
async function sendBackShower(env) {
  await alfredSend(`เดินกับโพล่าเสร็จแล้ว ได้เวลากลับเข้าบ้าน ให้อาหารโพล่า แล้วไปอาบน้ำแต่งตัวได้เลยครับ ทักสั้น ๆ 1-2 ประโยค`, env);
}

// Jarvis brief — ดึงจาก DASHBOARD.md
async function buildJarvisBrief(env) {
  const dashboard = await fetchGitHubFile("DASHBOARD.md", env);
  const profile = await fetchGitHubFile("memory/INTERVIEW-ANSWERS.md", env);
  return buildJarvisPrompt({ profile, dashboard });
}

// 08:00 — Jarvis morning brief
async function sendJarvisBrief(env) {
  const dt = thaiDateTime(new Date());
  const systemPrompt = await buildJarvisBrief(env);
  const text = await callClaude(systemPrompt,
    `ส่ง morning brief วันนี้ (${dt}) ในฐานะ Jarvis
กระชับ emoji ประกอบด้วย: งานสำคัญวันนี้จาก Dashboard + สิ่งที่ต้องตัดสินใจ + กำลังใจ 1 ประโยค`, env);
  await pushLine(text, env.LINE_TOKEN, env.LINE_USER_ID);
}

// เช็คการจราจร บ้าน → ที่ทำงาน
async function checkTraffic(env) {
  try {
    const [homeLat, homeLng] = env.HOME_COORDS.split(",");
    const [workLat, workLng] = env.WORK_COORDS.split(",");
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.GOOGLE_MAPS_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: parseFloat(homeLat), longitude: parseFloat(homeLng) } } },
        destination: { location: { latLng: { latitude: parseFloat(workLat), longitude: parseFloat(workLng) } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        departureTime: new Date().toISOString(),
      }),
    });
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) { console.error("checkTraffic: no route", JSON.stringify(data).slice(0, 300)); return null; }
    const mins = Math.round(parseInt(route.duration) / 60);
    const km = Math.round(route.distanceMeters / 1000);
    return { mins, km };
  } catch (e) {
    console.error("checkTraffic failed:", e);
    return null;
  }
}

// 06:30 — ก่อนออกบ้าน + เช็คการจราจรจริงจาก Google Maps
async function sendPreDeparture(env) {
  const traffic = await checkTraffic(env);
  // ข้อมูลจราจรต้องเป็น "ตัวเลขจริง" — สร้างเป็นข้อความตรง ๆ ไม่ส่งผ่าน LLM ซ้ำ ไม่งั้นตัวเลขจะเพี้ยน
  let trafficLine;
  if (traffic) {
    const { mins, km } = traffic;
    if (mins > 75) trafficLine = `เส้นทางไปทำงานตอนนี้รถติดมากครับ ใช้เวลาประมาณ ${mins} นาที (${km} กม.) ออกเร็วขึ้นอีกหน่อยจะดีกว่าครับ`;
    else if (mins > 60) trafficLine = `เส้นทางไปทำงานติดนิดหน่อยครับ ใช้เวลาประมาณ ${mins} นาที (${km} กม.) ออกตอนนี้ยังทันครับ`;
    else trafficLine = `การจราจรปกติครับ ใช้เวลาประมาณ ${mins} นาที (${km} กม.) ออกได้สบาย ๆ ครับ`;
  } else {
    trafficLine = `ตอนนี้ผมเช็คสภาพจราจรไม่ได้ครับ เผื่อเวลาออกบ้านสักหน่อยนะครับ`;
  }
  // ให้ Alfred ทักนำสั้น ๆ เป็นธรรมชาติ แล้วต่อด้วยข้อมูลจราจรจริง
  const memory = await buildMemory(env, true);
  const system = buildAlfredPrompt(memory);
  const intro = await callClaude(system, `ใกล้เวลาออกบ้านแล้ว (ประมาณ 06:30) ทักสั้น ๆ 1 ประโยคว่าได้เวลาเตรียมตัวออกบ้าน ห้ามพูดถึงการจราจรหรือตัวเลขเวลาเดินทางเอง เดี๋ยวผมต่อข้อมูลจราจรให้ท้ายเอง`, env);
  await pushLine(`${intro}\n\n${trafficLine}\n\nเดินทางปลอดภัยนะครับ`, env.LINE_TOKEN_ALFRED, env.LINE_USER_ID);
}

// ============ James Morning Brief — RSS (Bloomberg) + Notion ============
const NEWS_FEEDS = [
  { cat: "🌍 ตลาดโลก", url: "https://feeds.bloomberg.com/markets/news.rss" },
  { cat: "💼 เศรษฐกิจ", url: "https://feeds.bloomberg.com/economics/news.rss" },
  { cat: "🤖 เทคโนโลยี", url: "https://feeds.bloomberg.com/technology/news.rss" },
  { cat: "🏛️ การเมือง/นโยบาย", url: "https://feeds.bloomberg.com/politics/news.rss" },
];
// หน้า "ตารางงาน Eliné" — Notion page แม่ที่เก็บข่าวเช้ารายวัน
const NEWS_PARENT_PAGE = "378477bd-95b9-81dd-9177-c145469f54be";

function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&#x27;/g, "'");
}

function parseRSSItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const grab = (tag) => {
      const r = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`);
      const x = block.match(r);
      return x ? decodeEntities(x[1].replace(/<[^>]+>/g, "").trim()) : "";
    };
    items.push({ title: grab("title"), desc: grab("description"), link: grab("link"), pubDate: grab("pubDate") });
  }
  return items;
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, { headers: { "User-Agent": "Mozilla/5.0 (Eline Morning Brief)" } });
    if (!res.ok) return [];
    const xml = await res.text();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return parseRSSItems(xml)
      .filter(it => { const t = Date.parse(it.pubDate); return isNaN(t) ? true : t >= cutoff; })
      .slice(0, 8)
      .map(it => ({ ...it, cat: feed.cat }));
  } catch (e) { return []; }
}

async function callClaudeNews(prompt, env) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL_UTIL, max_tokens: 2500, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "[]";
}

async function createNewsNotionPage(dt, stories, env) {
  try {
    const cats = [...new Set(stories.map(s => s.cat))];
    const children = [];
    for (const cat of cats) {
      children.push({ object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: cat } }] } });
      for (const s of stories.filter(x => x.cat === cat)) {
        children.push({ object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: s.th_title } }] } });
        children.push({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: s.th_summary } }] } });
        children.push({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: "🔗 อ่านต่อที่ต้นทาง (Bloomberg)", link: { url: s.link } } }] } });
      }
    }
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.NOTION_TOKEN}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
      body: JSON.stringify({
        parent: { page_id: NEWS_PARENT_PAGE },
        properties: { title: { title: [{ text: { content: `📰 ข่าวเช้า ${dt}` } }] } },
        children,
      }),
    });
    const data = await res.json();
    if (data.url) return data.url;
    console.error("Notion news error:", JSON.stringify(data).slice(0, 300));
    return "";
  } catch (e) { console.error("Notion exc:", e); return ""; }
}

// 08:00 — James Morning Brief
async function sendNewsAlert(env) {
  const dt = thaiDateTime(new Date());
  const feeds = await Promise.all(NEWS_FEEDS.map(fetchFeed));
  const allItems = feeds.flat();

  if (allItems.length === 0) {
    await pushLine(`📰 James Morning Brief — ${dt}\n\nวันนี้ยังไม่มีข่าวใหม่ครับ`, env.LINE_TOKEN_ALFRED, env.LINE_USER_ID);
    return;
  }

  const raw = allItems.map((it, i) => `[${i}] (${it.cat}) ${it.title}\n${it.desc.slice(0, 220)}`).join("\n\n");
  const prompt = `คุณคือ James นักข่าวการเงินส่วนตัว เพศชาย คัดข่าวเช้าให้เจ้านายที่สนใจข่าวโลก เศรษฐกิจ ตลาดหุ้น การลงทุน เทคโนโลยี
จากรายการข่าวด้านล่าง เลือกเฉพาะข่าวที่สำคัญและมีผลต่อตลาด/โลกจริงๆ 6-10 ข่าว (ข้ามข่าวซ้ำหรือไม่สำคัญ)
ตอบเป็น JSON array เท่านั้น ห้ามมีข้อความอื่นนอก array:
[{"i": <index ตัวเลข>, "cat": "<หมวดเดิมจากรายการ>", "th_title": "<พาดหัวภาษาไทยกระชับ>", "th_summary": "<สรุป 1-2 ประโยคภาษาไทย อิงจากเนื้อที่ให้เท่านั้น ห้ามแต่งข้อมูลเพิ่ม>"}]

รายการข่าว:
${raw}`;

  const jsonText = await callClaudeNews(prompt, env);
  let picks = [];
  try { picks = JSON.parse(jsonText.match(/\[[\s\S]*\]/)[0]); } catch (e) { picks = []; }
  const stories = picks.map(p => ({ ...p, link: allItems[p.i]?.link || "" })).filter(s => s.link && s.th_title);

  if (stories.length === 0) {
    await pushLine(`📰 James Morning Brief — ${dt}\n\nวันนี้ยังไม่มีข่าวเด่นที่น่าสนใจครับ`, env.LINE_TOKEN_ALFRED, env.LINE_USER_ID);
    return;
  }

  const notionUrl = await createNewsNotionPage(dt, stories, env);
  const hook = stories.map(s => `• ${s.th_title}`).join("\n");
  let msg = `📰 James Morning Brief — ${dt}\n\nวันนี้มี ${stories.length} เรื่องเด่นครับ:\n\n${hook}`;
  if (notionUrl) msg += `\n\n👉 อ่านสรุปเต็มใน Notion:\n${notionUrl}`;
  else msg += `\n\n(สรุปเต็มใน Notion ขัดข้องชั่วคราวครับ)`;
  msg += `\n\n— James 🎩`;
  await pushLine(msg, env.LINE_TOKEN_ALFRED, env.LINE_USER_ID);
}

// 12:00 — เช็คกลางวัน
async function sendLunchCheck(env) {
  await alfredSend(`เวลาพักกลางวัน ส่งสั้นๆ เช็คว่ากินข้าวหรือยัง + เตือนวิตามิน + ถามว่าช่วงบ่ายเป็นยังไงบ้าง`, env);
}

// 17:30 — ก่อนกลับบ้าน
async function sendEveningPrep(env) {
  await alfredSend(`ใกล้เลิกงานแล้ว ดูจากงานค้างใน ALFRED-TASKS แล้วกรองเฉพาะสิ่งที่ต้องทำที่บ้านวันนี้ เช่น งานบ้าน ดูแลสัตว์เลี้ยง ซื้อของ ฯลฯ ถ้าไม่มีก็บอกว่าคืนนี้ไม่มีอะไรพิเศษ พักได้เต็มที่ + ขอให้เดินทางปลอดภัย`, env);
}

// 20:30 — ปิดวัน + preview พรุ่งนี้ + Frey checklist
async function sendEveningBrief(env) {
  const dt = thaiDateTime(new Date());
  await alfredSend(`ส่ง evening brief (${dt}):
1. preview งานพรุ่งนี้จากงานค้าง เผื่อคุณท่านอยากปรับ
2. Frey checklist สุขภาพ: วันนี้กินครบไหม / ออกกำลังกายไหม / เครียดระดับ 1-5`, env);
}

// 20:55 — เตรียมนอน
async function sendBedtime(env) {
  await alfredSend(`ใกล้เวลานอน ส่งสั้นมากๆ อบอุ่น บอกเตรียมนอนได้แล้ว + ปิดวันด้วย 1 ประโยค`, env);
}

// Weekend 06:30 — Morning Brief (ไม่มี traffic)
async function sendWeekendMorningBrief(env) {
  const dt = thaiDateTime(new Date());
  await alfredSend(`ส่ง weekend morning brief (${dt}) กระชับ emoji
ดูงานใน Notion วันนี้: ถ้ามีนัดหรืองานให้แจ้ง ถ้าไม่มีให้บอกว่าวันนี้ไม่มีกำหนดการ โฟกัสธุรกิจ/YouTube ได้เลย
ไม่ต้องเช็ค traffic เพราะวันหยุด`, env);
}

// Weekend 12:00 — กลางวัน + เช็ค meal prep
async function sendWeekendLunchCheck(env) {
  const now = new Date();
  const dow = now.toLocaleString("en-US", { weekday: "short", timeZone: "Asia/Bangkok" });
  const isSat = dow === "Sat";
  await alfredSend(`กลางวันวัน${isSat ? "เสาร์" : "อาทิตย์"} ส่งสั้นๆ เช็คว่ากินข้าวหรือยัง + ${isSat ? "เตือน meal prep ช่วงบ่ายถ้าสะดวก" : "เตือนพักผ่อน เติมพลังก่อนอาทิตย์ใหม่"} + วิตามิน`, env);
}

// ===== ตารางเวลา routine ประจำวัน =====
// t = เวลาไทยแบบ HHMM (ต้องเป็นช่วง 5 นาที) · days = 'all' | 'weekday' | 'weekend'
// เพิ่ม/แก้เวลาในอนาคต = เพิ่ม/แก้บรรทัดในตารางนี้ที่เดียว
const SCHEDULE = [
  { t: 400,  days: "all",     fn: sendMorningWakeup },      // ตื่น + routine เช้า
  { t: 430,  days: "all",     fn: sendFreyMorningCheck },   // Frey เช็คอาการหลัง Golden
  { t: 600,  days: "all",     fn: sendWalkPolar },          // พาโพล่าเดินข้างนอก
  { t: 615,  days: "all",     fn: sendBackShower },         // กลับบ้าน ให้อาหารโพล่า + อาบน้ำ
  { t: 630,  days: "weekday", fn: sendPreDeparture },       // ก่อนออกบ้าน + เช็คจราจร
  { t: 635,  days: "weekend", fn: sendWeekendMorningBrief },// บรีฟวันหยุด (ไม่มีจราจร)
  { t: 800,  days: "all",     fn: sendNewsAlert },          // ข่าวเช้า James
  { t: 800,  days: "weekday", fn: sendJarvisBrief },        // Jarvis morning brief (วันทำงาน)
  { t: 1200, days: "weekday", fn: sendLunchCheck },         // เช็คกลางวัน
  { t: 1200, days: "weekend", fn: sendWeekendLunchCheck },  // เช็คกลางวันวันหยุด
  { t: 1730, days: "weekday", fn: sendEveningPrep },        // ก่อนเลิกงาน
  { t: 2030, days: "all",     fn: sendEveningBrief },       // ปิดวัน + Frey checklist
  { t: 2100, days: "all",     fn: sendBedtime },            // เตรียมนอน
];

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Eliné webhook OK", { status: 200 });

    const body = await request.text();
    let payload;
    try { payload = JSON.parse(body); } catch { return new Response("bad", { status: 400 }); }

    const events = payload.events || [];
    const destination = payload.destination || "";
    ctx.waitUntil(processEvents(events, destination, env));
    return new Response("ok", { status: 200 });
  },

  async scheduled(event, env) {
    const now = new Date();
    const h = parseInt(now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Bangkok" }));
    const m = parseInt(now.toLocaleString("en-US", { minute: "numeric", timeZone: "Asia/Bangkok" }));
    const nowMin = h * 60 + m;

    // สวิตช์เดียวคุมทั้งวัน — 'weekday' = วันทำงาน, 'weekend' = วันหยุด/อยู่บ้าน
    // วันทำงาน = จันทร์-ศุกร์ และไม่ใช่วันหยุดในปฏิทิน และเจ้านายไม่ได้บอกว่าไม่ไป
    const workday = await isWorkdayToday(env);

    // ห่อทุก task: ถ้าอันใดอันหนึ่งพัง ตัวอื่นในรอบเดียวกันยังส่งต่อได้
    const run = async (fn) => {
      try { await fn(env); } catch (e) { console.error("scheduled task failed:", fn.name, e); }
    };

    // cron ยิงทุก 5 นาที — วน SCHEDULE แล้วส่งงานที่ "ถึงเวลาแล้วในรอบนี้"
    // หน้าต่าง 5 นาที = ยิงครั้งเดียวต่อช่วง และทน cron คลาดได้ ~5 นาทีโดยไม่ตกหล่น
    for (const s of SCHEDULE) {
      if (s.days === "weekday" && !workday) continue;
      if (s.days === "weekend" && workday) continue;
      const taskMin = Math.floor(s.t / 100) * 60 + (s.t % 100);
      if (nowMin >= taskMin && nowMin < taskMin + 5) await run(s.fn);
    }
  },
};
