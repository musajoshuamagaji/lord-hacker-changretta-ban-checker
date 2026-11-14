const { sendJson, methodNotAllowed, safeError, callProvider } = require("./_config");

module.exports = async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  const number = typeof req.body?.number === "string" ? req.body.number.trim() : "";
  if (!number) return sendJson(res, 400, { error: "Enter a phone number including its country code." });
  if (number.length > 32 || !/^\+[1-9]\d{6,14}$/.test(number)) {
    return sendJson(res, 400, { error: "Use international format, for example +491701234567." });
  }

  try {
    const { response, data, rateHeaders } = await callProvider("/api/v2/check", {
      method: "POST",
      body: { number }
    });
    return sendJson(res, response.status, data, rateHeaders);
  } catch (error) {
    const status = error.message?.includes("Server configuration") || error.message?.includes("BANCHECK_") ? 500 : 502;
    return sendJson(res, status, safeError(status, status === 500 ? error.message : "Could not reach the BanCheck provider."));
  }
};
