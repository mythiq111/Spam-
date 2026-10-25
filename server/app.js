import express from "express";
import { createHash, timingSafeEqual } from "node:crypto";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2kb" }));

const ANSWERS = {
  yes: "She said YES, you're best friends again!",
  time: "She said she needs a little time. Be patient and kind.",
};

// Email alert through Resend's HTTP API (no SMTP, works fine on serverless).
// Needs RESEND_API_KEY, RESEND_FROM (an address on your verified domain) and NOTIFY_EMAIL.
async function sendEmail(answer) {
  const { RESEND_API_KEY, RESEND_FROM, NOTIFY_EMAIL } = process.env;
  if (!RESEND_API_KEY || !RESEND_FROM || !NOTIFY_EMAIL) return;
  const who = process.env.FRIEND_NAME || "She";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: NOTIFY_EMAIL.split(",").map((s) => s.trim()),
        subject: `${who} replied: ${answer === "yes" ? "YES ❤" : "needs some time"}`,
        text: `${ANSWERS[answer]}\n\nAt ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (IST)`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) console.error("email failed:", r.status, await r.text());
  } catch (err) {
    console.error("email failed:", err.message);
  }
}

// Light in-memory throttle so the endpoint can't be spammed.
const hits = new Map();
function throttle(req, res, next) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 10) return res.status(429).json({ ok: false });
  recent.push(now);
  hits.set(ip, recent);
  next();
}

app.get("/api/config", (_req, res) => {
  res.json({
    friendName: process.env.FRIEND_NAME || "Friend",
    myName: process.env.MY_NAME || "Me",
    whatsapp: (process.env.MY_WHATSAPP || "").replace(/\D/g, ""),
  });
});

// Password gate for the photos page. The password lives only in GALLERY_PASSWORD, never in the client.
app.post("/api/unlock", throttle, (req, res) => {
  const expected = process.env.GALLERY_PASSWORD;
  if (!expected) return res.status(503).json({ ok: false });
  const given = String(req.body?.password ?? "").trim();
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  res.json({ ok: timingSafeEqual(a, b) });
});

app.post("/api/answer", throttle, async (req, res) => {
  const answer = req.body?.answer;
  if (!Object.hasOwn(ANSWERS, answer)) {
    return res.status(400).json({ ok: false, error: "Invalid answer" });
  }

  console.log(`[answer] ${answer} at ${new Date().toISOString()}`);

  // Everything is awaited so a serverless function doesn't exit before it is sent.
  await sendEmail(answer);

  const topic = process.env.NTFY_TOPIC;
  if (topic) {
    try {
      // Awaited so the serverless function doesn't exit before it is sent.
      await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
        method: "POST",
        headers: { Title: `${process.env.FRIEND_NAME || "She"} replied` },
        body: ANSWERS[answer],
        signal: AbortSignal.timeout(4000),
      });
    } catch (err) {
      console.error("notify failed:", err.message);
    }
  }

  res.json({ ok: true });
});

export default app;
