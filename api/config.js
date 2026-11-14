const { getConfig, sendJson, methodNotAllowed } = require("./_config");

module.exports = (req, res) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const config = getConfig();
    return sendJson(res, 200, {
      environment: config.environment,
      bulkMax: config.bulkMax
    });
  } catch {
    return sendJson(res, 200, {
      environment: "unconfigured",
      bulkMax: null
    });
  }
};
