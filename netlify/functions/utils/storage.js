/* ============================================================
   storage.js — Netlify Blobs abstraction for BuildChangeOrder
   Explicitly passes siteID + token so bundled @netlify/blobs
   can find credentials from env vars.
   ============================================================ */

const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");

const MAX_BODY_BYTES = 512 * 1024; // 512 KB

// Wrapper: explicitly passes credentials when available
function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token  = process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) return getStore({ name, siteID, token });
  return getStore(name);
}

// Secure SHA-256 hash
function hashKey(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

// Legacy hash — kept ONLY for migration lookups
function legacySimpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return "h" + Math.abs(h).toString(36);
}

function generateKey() {
  return "bco_" + crypto.randomBytes(24).toString("base64url");
}

async function registerKey(email) {
  const apiKey   = generateKey();
  const hash     = hashKey(apiKey);
  const keyStore = store("bco-keys");

  await keyStore.setJSON(hash, {
    email,
    tier:       "free",
    created_at: new Date().toISOString(),
    usage:      {},
  });

  const emailStore = store("bco-emails");
  const emailHash  = hashKey(email);
  await emailStore.setJSON(emailHash, { hash, created_at: new Date().toISOString() });

  // Also store under legacy email hash for backward compat during transition
  const legacyEmailHash = legacySimpleHash(email);
  if (legacyEmailHash !== emailHash) {
    await emailStore.setJSON(legacyEmailHash, { hash, created_at: new Date().toISOString() });
  }

  return { apiKey };
}

async function emailHasKey(email) {
  const emailStore = store("bco-emails");

  // Try SHA-256 hash first
  let record = await emailStore.get(hashKey(email), { type: "json" }).catch(() => null);
  if (record) return true;

  // Fall back to legacy hash
  record = await emailStore.get(legacySimpleHash(email), { type: "json" }).catch(() => null);
  return !!record;
}

async function checkRegistrationLimit(ip) {
  const limStore = store("bco-reg-limits");
  const key      = `ip_${hashKey(ip)}`;

  // Also check legacy key for existing rate limit records
  const legacyKey = `ip_${legacySimpleHash(ip)}`;

  let record = await limStore.get(key, { type: "json" }).catch(() => null);
  if (!record) {
    record = await limStore.get(legacyKey, { type: "json" }).catch(() => null);
  }

  const now  = Date.now();
  const hour = 3600 * 1000;

  if (!record) return { allowed: true };
  if (now - record.firstAttempt > hour) return { allowed: true };
  if (record.count >= 5) return { allowed: false };
  return { allowed: true };
}

async function recordRegistrationAttempt(ip) {
  const limStore = store("bco-reg-limits");
  const key      = `ip_${hashKey(ip)}`;
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
