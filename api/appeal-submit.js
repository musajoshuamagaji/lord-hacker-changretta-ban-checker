const { getConfig, sendJson, methodNotAllowed, safeError, callProvider } = require("./_config");

module.exports = async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  let config;
  try {
    config = getConfig();
  } catch (error) {
    return sendJson(res, 500, safeError(500, error.message));
  }

  if (config.environment !== "live") {
    return sendJson(res, 403, { error: "Appeal submission is disabled in sandbox. Switch to live only when you are authorized and ready to submit." });
  }

  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const isEu = req.body?.isEu;

  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    return sendJson(res, 400, { error: "Provide a valid international phone number." });
  }
  if (text.length < 10) {
    return sendJson(res, 400, { error: "Appeal text must be at least 10 characters." });
  }
  if (text.length > 4000) {
    return sendJson(res, 400, { error: "Appeal text must be 4000 characters or fewer." });
  }
  if (typeof isEu !== "boolean") {
    return sendJson(res, 400, { error: "isEu must be true or false." });
  }

  try {
    const { response, data } = await callProvider("/api/v2/appeal-submit", {
      method: "POST",
      body: { phone, text, isEu }
    });
    return sendJson(res, response.status, data);
  } catch (error) {
    const status = error.message?.includes("Server configuration") || error.message?.includes("BANCHECK_") ? 500 : 502;
    return sendJson(res, status, safeError(status, status === 500 ? error.message : "Could not reach the BanCheck provider."));
  }
};
