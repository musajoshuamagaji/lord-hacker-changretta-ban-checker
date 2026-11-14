const ALLOWED_ENVIRONMENTS = new Set(["sandbox", "live"]);

function getConfig() {
  const rawBase = process.env.BANCHECK_API_URL || "https://lord-hacker-changretta-ban-checker.vercel.app/";
  const apiKey = process.env.BANCHECK_API_KEY || "bk_v1_g5Pyv6y0bm9sYTIv02KGXLQX9cM-aKQwGoqefzBGnWUSHxEQo1BgA815XfI-1IF04oGmxL0ix-GRKxqjdotNVqWv1Kdxvk6pGJYfIi4GAgpYzxM-u1vDv8xPiDtUoKULLxSq5Io4UweKttm3ztfbHoUVy-aBduOmhZy4mupZ9z0tKJ-WlelSIPVxEIxie2rJP-NwquwAmnk0ijUqAzKk0UWlCEEa_2ySGgh5yj-2UNMq5QcXuw9I4AKpprKRAuZyNyGesKPN5fbFTc2kYq1ZL5DTGEVFzTMN_qUm0MtpxRB4IwIJ5NwX4VGzFoaIPb3jE-_rV7TYhye9sNRsEyJT5cL9GtyORHGuiPfxBrAeQH5IGSw1oHA3MFFtRJ8ER8ecj4p9r7ovn-VSdp4bUEXd1QCSha5SOfAho0beVcgAa9zIQzfrAr9GTUxdyXJkQeNOiq3XE30A1TOSFWrF9cHRK1ZDLVlmayEPUMpF9VMkOgaKCjV09FCe6WEGY6KU9C31SZGUjXh0BfgNa9mnrR5VgD0aWA39P705iTQLecI_NSACtcn947O5A_9K_51RWw3lE4Lm1QENTtOIBeWaXR1SsEAniSBFlevdTiRc3x1oybP7BQ";
  const environment = String(process.env.BANCHECK_ENV || "sandbox").toLowerCase();
  const bulkMax = Number.parseInt(process.env.BANCHECK_BULK_MAX || "10", 10);

  let baseUrl;
  try {
    baseUrl = new URL(rawBase);
  } catch {
    throw new Error("Server configuration missing: set BANCHECK_API_URL to the provider origin.");
  }

  if (!["https:"].includes(baseUrl.protocol)) {
    throw new Error("BANCHECK_API_URL must use HTTPS.");
  }
  if (!apiKey) throw new Error("Server configuration missing: set BANCHECK_API_KEY.");
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error("BANCHECK_ENV must be either sandbox or live.");
  }
  if (!Number.isInteger(bulkMax) || bulkMax < 1 || bulkMax > 500) {
    throw new Error("BANCHECK_BULK_MAX must be an integer between 1 and 500.");
  }

  return {
    baseUrl: baseUrl.origin,
    apiKey,
    environment,
    bulkMax
  };
}

function sendJson(res, status, payload, extraHeaders = {}) {
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (value !== undefined && value !== null) res.setHeader(key, String(value));
  }
  res.status(status).json(payload);
}

function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  return sendJson(res, 405, { error: "Method not allowed" });
}

function safeError(status, message, requestId) {
  return {
    error: message || "The BanCheck service could not complete the request.",
    status,
    ...(requestId ? { requestId } : {})
  };
}

function forwardRateLimitHeaders(upstream) {
  const names = [
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset"
  ];
  const output = {};
  for (const name of names) {
    const value = upstream.headers.get(name);
    if (value !== null) output[name] = value;
  }
  return output;
}

async function callProvider(path, { method = "GET", body } = {}) {
  const config = getConfig();
  const url = new URL(path, config.baseUrl);
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-BanCheck-Environment": config.environment
  };

  const response = await fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000)
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: "Provider returned an unreadable response." };
  }

  return {
    response,
    data,
    rateHeaders: forwardRateLimitHeaders(response)
  };
}

module.exports = {
  getConfig,
  sendJson,
  methodNotAllowed,
  safeError,
  callProvider
};
