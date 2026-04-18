/* register.js — POST /api/v1/register */
const { jsonResponse, errorResponse, CORS_HEADERS } = require("./utils/auth");
const { registerKey, emailHasKey, checkRegistrationLimit, recordRegistrationAttempt } = require("./utils/storage");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") return errorResponse(405, "Use POST.");

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return errorResponse(400, "Invalid JSON."); }

  const { email } = body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorResponse(400, "Valid email required.");

  const ip = event.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  if (!(await checkRegistrationLimit(ip)).allowed) return errorResponse(429, "Too many registrations from this IP.");
  if (await emailHasKey(email)) return errorResponse(409, "An API key already exists for this email.");

  await recordRegistrationAttempt(ip);
  const { apiKey } = await registerKey(email);

  return jsonResponse(201, {
    success: true,
    api_key: apiKey,
    tier:    "free",
    quota:   { change_orders_per_month: 25 },
    message: "Save your API key — it won't be shown again.",
    docs:    "https://buildchangeorder.co/api/docs",
  });
};
