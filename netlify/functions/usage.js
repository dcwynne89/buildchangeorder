/* usage.js — GET /api/v1/usage */
const { authenticate, jsonResponse } = require("./utils/auth");
const { getUsage } = require("./utils/storage");

exports.handler = async (event) => {
  const { auth, response } = await authenticate(event, { countUsage: false });
  if (response) return response;
  const used  = await getUsage(auth.hash);
  const limit = auth.tier.changeOrdersPerMonth;
  return jsonResponse(200, {
    success: true, tier: auth.tier.name,
    usage: { used, limit, remaining: Math.max(0, limit - used) },
    features: { watermark: auth.tier.watermark, logo: auth.tier.logoEnabled },
  });
};
