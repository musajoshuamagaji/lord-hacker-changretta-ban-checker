const { getConfig, sendJson, methodNotAllowed, safeError, callProvider } = require("./_config");

module.exports = async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  const numbers = req.body?.numbers;
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return sendJson(res, 400, { error: "Provide a non-empty numbers array." });
  }

  let config;
  try {
    config = getConfig();
  } catch (error) {
    return sendJson(res, 500, safeError(500, error.message));
  }

  if (numbers.length > config.bulkMax) {
    return sendJson(res, 400, {
      error: `Your configured bulk limit is ${config.bulkMax} numbers per request.`,
      bulkMax: config.bulkMax
    });
  }

  const normalized = numbers.map(value => typeof value === "string" ? value.trim() : "");
  if (normalized.some(value => value.length > 32)) {
    return sendJson(res, 400, { error: "One or more phone numbers are too long." });
  }

  try {
    const { response, data, rateHeaders } = await callProvider("/api/v2/bulk-check", {
      method: "POST",
      body: { numbers: normalized }
    });
    return sendJson(res, response.status, data, rateHeaders);
  } catch (error) {
    const status = error.message?.includes("Server configuration") || error.message?.includes("BANCHECK_") ? 500 : 502;
    return sendJson(res, status, safeError(status, status === 500 ? error.message : "Could not reach the BanCheck provider."));
  }
};
