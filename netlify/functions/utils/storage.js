/* ============================================================
   storage.js — BuildChangeOrder key management & usage tracking
   Powered by @buildplatform/api-core
   ============================================================ */
const api = require("./api-core-config");

module.exports = {
  registerKey:               api.registerKey,
  emailHasKey:               api.emailHasKey,
  checkRegistrationLimit:    api.checkRegistrationLimit,
  recordRegistrationAttempt: api.recordRegistrationAttempt,
  incrementUsage:            api.incrementUsage,
  getUsage:                  api.getUsage,
  MAX_BODY_BYTES:            api.MAX_BODY_BYTES,
};
