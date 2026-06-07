/**
 * Eliné LINE Webhook — Cloudflare Worker
 * รับข้อความจาก LINE → ดึง memory จาก GitHub → Claude ตอบ → ส่งกลับ LINE
 * Morning Brief อัตโนมัติทุกเช้า 04:00 น. (ตามเวลาไทย = 21:00 UTC)
 */

const GITHUB_REPO = "mdpjbsn-byte/eline-ai-team";

// ดึงไฟล์จาก GitHub
async function fetchGitHubFile(path, env) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      "Authorization": `token ${env.GITHUB_TOKEN}`,
      "User-Agent": "Eline-LINE-Bot",
      "Accept": "application/vnd.github.v3.raw",
    },
  });
  if (!res.ok) return "";
  return await res.text();
}

// สร้าง system prompt พร้อม memory
async function buildSystemPrompt(env) {
  const [profile, routine, dashboard] = await Promise.all([
    fetchGitHubFile("memory/INTERVIEW-ANSWERS.md", env),
    fetchGitHubFile("memory/DAILY-ROUTINE.md", env),
    fetchGitHubFile("DASHBOARD.md", env),
  ]);

  return `คุณคือทีม AI ส่วนตัวของคุณท่าน (เอลิเน่ / หมูแดง) ตอบผ่าน LINE
ภาษาไทย · กระชับ อ่านง่าย (ไม่ยาวเกิน)

กฎเหล็ก: ขึ้นต้นทุกข้อความด้วยชื่อตัวเองเสมอ เช่น "🎩 Alfred:" หรือ "🩺 Frey:" แล้วใช้คำลงท้ายให้ถูกต้องตลอดทั้งข้อความ ห้ามปนกัน

ดูเรื่องที่พูด แล้วตอบด้วย "เสียง" ของคนที่เหมาะ:
- สุขภาพ/เครียด/เหนื่อย/อารมณ์ → 🩺 Frey — เรียกว่า "เจ้านาย" · ลงท้าย "ค่ะ" ทุกประโยค ห้ามใช้ "ครับ"
- routine/บ้าน/ของใช้/กิน/ทักทาย → 🎩 Alfred — เรียกว่า "คุณท่าน" · ลงท้าย "ครับ" ทุกประโยค ห้ามใช้ "ค่ะ" · พูดสุภาพแบบ English butler · ไม่ออกคำสั่ง แต่เสนอแนะ
- งาน/ธุรกิจ/วางแผน → 🎯 Jarvis — เรียกว่า "เจ้านาย" · ลงท้าย "ครับ" ทุกประโยค ห้ามใช้ "ค่ะ"
- การเงิน/ลงทุน → 💼 Arena — เรียกว่า "เจ้านาย" · ลงท้าย "ค่ะ" ทุกประโยค ห้ามใช้ "ครับ"

=== ข้อมูลเจ้านาย ===
${profile ? profile.substring(0, 3000) : "ไม่มีข้อมูล"}

=== Routine ปัจจุบัน ===
${routine ? routine.substring(0, 1500) : "ไม่มีข้อมูล"}

=== Dashboard / งานค้าง ===
${dashboard ? dashboard.substring(0, 1500) : "ไม่มีข้อมูล"}`;
}

// Morning Brief
async function sendMorningBrief(env) {
  const systemPrompt = await buildSystemPrompt(env);
  const now = new Date();
  const day = now.toLocaleDateString("th-TH", { weekday: "long", timeZone: "Asia/Bangkok" });
  const date = now.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });

  const briefPrompt = `สร้าง Morning Brief สำหรับเจ้านายวันนี้ (${day} ${date})
โดยดูจาก Dashboard และ Routine ที่มี ให้กระชับ อ่านง่าย มี emoji
ประกอบด้วย: สวัสดี + วันที่ + small goal วันนี้ + งานสำคัญ + ข้อความให้กำลังใจสั้นๆ`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: briefPrompt }],
    }),
  });
  const data = await res.json();
  const brief = data.content?.[0]?.text || "🌅 อรุณสวัสดิ์ครับเจ้านาย!";

  await pushLine(brief, env);
}

// Push message (ส่งหาเจ้านายก่อน)
async function pushLine(text, env) {
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.LINE_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: env.LINE_USER_ID,
      messages: [{ type: "text", text }],
    }),
  });
}

// Reply message (ตอบกลับ)
async function replyLine(replyToken, text, env) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.LINE_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
}

async function processEvents(events, env) {
  for (const ev of events) {
    if (ev.type === "message" && ev.message?.type === "text") {
      const userText = ev.message.text;
      const replyToken = ev.replyToken;
      try {
        const systemPrompt = await buildSystemPrompt(env);
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 500,
            system: systemPrompt,
            messages: [{ role: "user", content: userText }],
          }),
        });
        const data = await res.json();
        const reply = data.content?.[0]?.text || "ขออภัยครับ ตอบไม่ได้ตอนนี้";
        await replyLine(replyToken, reply, env);
      } catch (e) {
        await replyLine(replyToken, "ขออภัยครับเจ้านาย ระบบขัดข้องชั่วคราว 🙏", env);
      }
    }
  }
}

export default {
  // รับข้อความจาก LINE — return 200 ทันที แล้วค่อย process ใน background
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Eliné webhook OK", { status: 200 });

    const body = await request.text();
    let payload;
    try { payload = JSON.parse(body); } catch { return new Response("bad", { status: 400 }); }

    const events = payload.events || [];
    ctx.waitUntil(processEvents(events, env));
    return new Response("ok", { status: 200 });
  },

  // Cron: Morning Brief ทุกเช้า 04:00 น. ไทย (21:00 UTC)
  async scheduled(event, env) {
    await sendMorningBrief(env);
  },
};
