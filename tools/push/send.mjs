// The daily push (2026-09-25). Run by .github/workflows/notify.yml at 08:00 and 20:00 Asia/Seoul from two repository
// secrets: PUSH_SUBSCRIPTION (the subscription JSON the user copied from 설정 › 푸시 알림) and VAPID_PRIVATE_KEY.
// PUSH_VAPID_PUBLIC below is the key the app subscribes with (src/LifeManager.jsx); smoke 7(f) pins the two equal.
// The payload is never read by the worker — it shows the text the app last cached — so nothing about the user's
// records is here. This script prints status codes only: the repository and its Actions logs are public, and
// web-push's error object carries the endpoint, so every failure is caught and turned into an exit code.
import webPush from "web-push";

const PUSH_VAPID_PUBLIC = "BNY_5NIX_6aiCRhaKXmthcAcsgQlfupE2lHo_MSKyHemYEOfxke83RjUYk1SPs55JC7GWeSF3IDcV4WhRYc8agM";
const SUBJECT = "https://github.com/Jojunehyung/JARVIS";
const TTL_SECONDS = 6 * 3600; // a phone that is off longer than this misses the wake-up rather than getting it late

const sub = process.env.PUSH_SUBSCRIPTION;
const priv = process.env.VAPID_PRIVATE_KEY;
if (!sub || !priv) {
  console.log("daily push: secrets not set — nothing sent");
  process.exit(0);
}
let parsed = null;
try {
  parsed = JSON.parse(sub);
  if (!parsed?.endpoint || !parsed?.keys?.p256dh || !parsed?.keys?.auth) parsed = null;
} catch {
  parsed = null;
}
if (!parsed) {
  console.log("daily push: PUSH_SUBSCRIPTION is not a subscription JSON — copy it again from the app");
  process.exit(1);
}
let code = null;
try {
  webPush.setVapidDetails(SUBJECT, PUSH_VAPID_PUBLIC, priv);
  const res = await webPush.sendNotification(parsed, JSON.stringify({ open: "issues" }), { TTL: TTL_SECONDS, urgency: "high", topic: "life-check" });
  console.log(`daily push: sent (${res.statusCode})`);
  process.exit(0);
} catch (err) {
  code = err?.statusCode || null;
}
if (code === 404 || code === 410) {
  console.log("daily push: subscription expired — copy it again from the app");
  process.exit(2);
}
console.log(`daily push: failed (${code || "no status"})`);
process.exit(1);
