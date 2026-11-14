const { sendJson, methodNotAllowed, safeError, callProvider } = require("./_config");

module.exports = async (req, res) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const phone = typeof req.query?.phone === "string" ? req.query.phone.trim() : "";
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    return sendJson(res, 400, { error: "Provide a valid international phone number." });
  }

  try {
    const { response, data } = await callProvider(`/api/v2/appeal-status?phone=${encodeURIComponent(phone)}`);
    return sendJson(res, response.status, data);
  } catch (error) {
    const status = error.message?.includes("Server configuration") || error.message?.includes("BANCHECK_") ? 500 : 502;
    return sendJson(res, status, safeError(status, status === 500 ? error.message : "Could not reach the BanCheck provider."));
  }
};
