/* BuildChangeOrder — API core configuration
   Includes legacy simpleHash migration for backward compatibility */
const { createApiCore } = require("../../../shared/api-core");
const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

const TIERS = {
  free:    { name: "free",    changeOrdersPerMonth: 25,     watermark: true,  logoEnabled: false },
  starter: { name: "starter", changeOrdersPerMonth: 200,    watermark: false, logoEnabled: true },
  pro:     { name: "pro",     changeOrdersPerMonth: 1000,   watermark: false, logoEnabled: true },
  ultra:   { name: "ultra",   changeOrdersPerMonth: 999999, watermark: false, logoEnabled: true },
};

const api = createApiCore({
  keyPrefix: "bco_",
  quotaField: "changeOrdersPerMonth",
  maxBodyBytes: 512 * 1024,
  maxRegistrationsPerHour: 5,
  quotaMessage: "Monthly limit reached. Upgrade at buildchangeorder.co/api/docs",
  upgradeUrl: "https://buildchangeorder.co/api/docs",
  enableRateLimiter: false,
  defaultCountUsage: false,
  tiers: TIERS,
});

/* ── Legacy simpleHash migration ────────────────────────────── */

function legacySimpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return "h" + Math.abs(h).toString(36);
}

function getConfiguredStore(name) {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token  = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_API_TOKEN;
  if (siteID && token) return getStore({ name, siteID, token });
  return getStore(name);
}

/**
 * Wraps the core authenticate to add legacy hash fallback.
 * If the SHA-256 lookup fails, tries the old simpleHash and migrates
 * the key to SHA-256 on first use.
 */
const coreAuthenticate = api.authenticate;

async function authenticate(event, options = {}) {
  const result = await coreAuthenticate(event, options);

  // If auth succeeded or it's a non-401 response, return as-is
  if (result.auth || !result.response || result.response.statusCode !== 401) {
    return result;
  }

  // Extract the API key again for legacy lookup
  const apiKey =
    event.headers["x-api-key"] ||
    event.headers["x-rapidapi-proxy-secret"] ||
    (event.headers["authorization"] || "").replace(/^Bearer\s+/i, "");

  if (!apiKey || !apiKey.startsWith("bco_")) return result;

  // Try legacy hash in the old "bco-keys" store
  const legacyHash = legacySimpleHash(apiKey);
  const legacyStore = getConfiguredStore("bco-keys");
  const legacyRecord = await legacyStore.get(legacyHash, { type: "json" }).catch(() => null);

  if (!legacyRecord) return result; // genuinely not found

  // Migrate: register in the new standard store, then delete legacy
  const sha256Hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const standardStore = getConfiguredStore("api-keys");
  await standardStore.setJSON(sha256Hash, {
    email: legacyRecord.email,
    tier: legacyRecord.tier || "free",
    createdAt: legacyRecord.created_at || new Date().toISOString(),
    active: true,
  });

  // Delete legacy entry
  await legacyStore.delete(legacyHash).catch(() => {});

  // Re-run auth with the now-migrated key
  return coreAuthenticate(event, options);
}

api.authenticate = authenticate;
module.exports = api;
