/* health.js — GET /api/v1/health */
const { jsonResponse, CORS_HEADERS } = require("./utils/auth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  return jsonResponse(200, { status: "ok", service: "BuildChangeOrder API", version: "1.0.0", timestamp: new Date().toISOString() });
};
