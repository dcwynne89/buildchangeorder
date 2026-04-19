/* ============================================================
   auth.js — API key authentication & rate limiting
   Adapted for BuildChangeOrder (bco_ prefix)
   ============================================================ */

const { getStore } = require("@netlify/blobs");

// Explicitly pass credentials so bundled @netlify/blobs finds them
function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token  = process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) return getStore({ name, siteID, token });
  return getStore(name);
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
};

const TIERS = {
  free: {
    name:             "free",
    changeOrdersPerMonth: 25,
    watermark:        true,
    logoEnabled:      false,
  },
  starter: {
    name:             "starter",
    changeOrdersPerMonth: 200,
    watermark:        false,
    logoEnabled:      true,
  },
  pro: {
    name:             "pro",
    changeOrdersPerMonth: 1000,
    watermark:        false,
    logoEnabled:      true,
  },
  ultra: {
    name:             "ultra",
    changeOrdersPerMonth: 999999,
    watermark:        false,
    logoEnabled:      true,
  },
};

async function authenticate(event, { countUsage = false } = {}) {
  if (event.httpMethod === "OPTIONS") {
    return { auth: null, response: { statusCode: 204, headers: CORS_HEADERS, body: "" } };
  }

  const apiKey =
    event.headers["x-api-key"] ||
    event.headers["x-rapidapi-proxy-secret"] ||
    (event.headers["authorization"] || "").replace(/^Bearer\s+/i, "");

  if (!apiKey || !apiKey.startsWith("bco_")) {
    return {
      auth: null,
      response: errorResponse(401, "Missing or invalid API key. Include X-API-Key: bco_yourkey", {
        docs: "https://buildchangeorder.co/api/docs",
      }),
    };
  }

  const hash  = simpleHash(apiKey);
  const keyStore = store("bco-keys");
  const record = await keyStore.get(hash, { type: "json" }).catch(() => null);

  if (!record) {
    return { auth: null, response: errorResponse(401, "API key not found.", { docs: "https://buildchangeorder.co/api/docs" }) };
  }

  const tier   = TIERS[record.tier] || TIERS.free;
  const month  = new Date().toISOString().slice(0, 7);
  const used   = record.usage?.[month] || 0;
  const limit  = tier.changeOrdersPerMonth;

  if (countUsage && used >= limit) {
    return {
      auth: null,
      response: errorResponse(429, `Monthly limit reached (${limit} change orders). Upgrade at buildchangeorder.co/api/docs`, {
        used, limit, tier: tier.name, reset: "1st of next month",
      }),
    };
  }

  return {
    auth: { hash, tier, quota: { used, limit, remaining: Math.max(0, limit - used) } },
    response: null,
  };
}

function jsonResponse(status, body) {
  return {
    statusCode: status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function errorResponse(status, message, extra = {}) {
  return jsonResponse(status, { success: false, error: message, ...extra });
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return "h" + Math.abs(h).toString(36);
}

module.exports = { authenticate, jsonResponse, errorResponse, CORS_HEADERS, TIERS };
