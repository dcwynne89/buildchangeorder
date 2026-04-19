/* ============================================================
   storage.js — Netlify Blobs abstraction for BuildChangeOrder
   Explicitly passes siteID + token so bundled @netlify/blobs
   can find credentials from env vars.
   ============================================================ */

const { getStore } = require("@netlify/blobs");

const MAX_BODY_BYTES = 512 * 1024; // 512 KB

// Wrapper: explicitly passes credentials when available
function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token  = process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) return getStore({ name, siteID, token });
  return getStore(name);
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return "h" + Math.abs(h).toString(36);
}

function generateKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "bco_";
  for (let i = 0; i < 32; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

async function registerKey(email) {
  const apiKey   = generateKey();
  const hash     = simpleHash(apiKey);
  const keyStore = store("bco-keys");

  await keyStore.setJSON(hash, {
    email,
    tier:       "free",
    created_at: new Date().toISOString(),
    usage:      {},
  });

  const emailStore = store("bco-emails");
  await emailStore.setJSON(simpleHash(email), { hash, created_at: new Date().toISOString() });

  return { apiKey };
}

async function emailHasKey(email) {
  const emailStore = store("bco-emails");
  const record = await emailStore.get(simpleHash(email), { type: "json" }).catch(() => null);
  return !!record;
}

async function checkRegistrationLimit(ip) {
  const limStore = store("bco-reg-limits");
  const key      = `ip_${simpleHash(ip)}`;
  const record   = await limStore.get(key, { type: "json" }).catch(() => null);
  const now      = Date.now();
  const hour     = 3600 * 1000;

  if (!record) return { allowed: true };
  if (now - record.firstAttempt > hour) return { allowed: true };
  if (record.count >= 5) return { allowed: false };
  return { allowed: true };
}

async function recordRegistrationAttempt(ip) {
  const limStore = store("bco-reg-limits");
  const key      = `ip_${simpleHash(ip)}`;
  const record   = await limStore.get(key, { type: "json" }).catch(() => null);
  const now      = Date.now();

  if (!record || now - record.firstAttempt > 3600 * 1000) {
    await limStore.setJSON(key, { count: 1, firstAttempt: now });
  } else {
    await limStore.setJSON(key, { ...record, count: record.count + 1 });
  }
}

async function incrementUsage(hash) {
  const keyStore = store("bco-keys");
  const record   = await keyStore.get(hash, { type: "json" }).catch(() => null);
  if (!record) return;
  const month = new Date().toISOString().slice(0, 7);
  const usage = record.usage || {};
  usage[month] = (usage[month] || 0) + 1;
  await keyStore.setJSON(hash, { ...record, usage });
}

async function getUsage(hash) {
  const keyStore = store("bco-keys");
  const record   = await keyStore.get(hash, { type: "json" }).catch(() => null);
  if (!record) return 0;
  const month = new Date().toISOString().slice(0, 7);
  return record.usage?.[month] || 0;
}

module.exports = {
  registerKey, emailHasKey, checkRegistrationLimit,
  recordRegistrationAttempt, incrementUsage, getUsage, MAX_BODY_BYTES,
};
