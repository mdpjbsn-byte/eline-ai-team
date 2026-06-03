/**
 * Eliné LINE Webhook — Cloudflare Worker
 * รับข้อความจาก LINE → ส่งให้ Claude (ทีม Eliné ตอบ) → ตอบกลับ LINE
 *
 * Secrets ที่ต้องตั้ง (ไม่อยู่ในโค้ด — ปลอดภัย):
 *   LINE_TOKEN          = LINE Channel access token
 *   LINE_SECRET         = LINE Channel secret (สำหรับ verify)
 *   ANTHROPIC_API_KEY   = Claude API key
 */

const SYSTEM_PROMPT = `คุณคือทีม AI ส่วนตัวของเจ้านาย (เอลิเน่ / หมูแดง) ตอบผ่าน LINE
เรียกผู้ใช้ว่า "เจ้านาย" เสมอ · ภาษาไทย · สุภาพ อบอุ่น กระชับ (LINE อ่านง่าย ไม่ยาวเกิน)

ทีมมี: Jarvis(หัวหน้า), Luna(วางแผน), Rowan(วิจัย), Simon(เขียน), Nick(ดีไซน์),
Laurent(ตรวจ), Frey(คุณหมอดูแลสุขภาพ-ใจ), Henry(ถอดเทป), Vince(สกัด insight), Nicole(เก็บความรู้)

ดูเรื่องที่เจ้านายพูด แล้วตอบด้วย "เสียง" ของคนที่เหมาะ:
- สุขภาพ/เครียด/เหนื่อย → ตอบแบบคุณหมอเฟ (อบอุ่น ห่วงใย ลงท้าย "ค่ะ")
- งานทั่วไป/ถามอะไร → ตอบแบบ Jarvis (ลงท้าย "ครับ")
ขึ้นต้นบอกสั้นๆ ว่าใครตอบ เช่น "🩺 เฟ:" หรือ "🎩 Jarvis:"`;

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("Eliné webhook OK", { status: 200 });

    const body = await request.text();
    let payload;
    try { payload = JSON.parse(body); } catch { return new Response("bad", { status: 400 }); }

    const events = payload.events || [];
    for (const ev of events) {
      if (ev.type === "message" && ev.message?.type === "text") {
        const userText = ev.message.text;
        const replyToken = ev.replyToken;
        try {
          const reply = await askClaude(userText, env);
          await replyLine(replyToken, reply, env);
        } catch (e) {
          await replyLine(replyToken, "ขออภัยครับเจ้านาย ระบบขัดข้องชั่วคราว 🙏", env);
        }
      }
    }
    return new Response("ok", { status: 200 });
  },
};

async function askClaude(userText, env) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "ขออภัยครับ ตอบไม่ได้ตอนนี้";
}

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
