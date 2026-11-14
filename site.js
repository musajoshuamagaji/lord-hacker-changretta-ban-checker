const $ = (selector) => document.querySelector(selector);
const state = { checks: 0, banned: 0, clean: 0, history: [] };
const envBadge = $("#envBadge");

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2800);
}
function phoneIsValid(value) { return /^\+[1-9]\d{6,14}$/.test(value.trim()); }
function normalizePhone(value) {
  let v = value.trim().replace(/[()\s.-]/g, "");
  if (v.startsWith("00")) v = "+" + v.slice(2);
  return v;
}
function setLoading(button, loading, label) {
  button.disabled = loading;
  if (loading) { button.dataset.original = button.innerHTML; button.textContent = "Checking…"; }
  else if (button.dataset.original) { button.innerHTML = button.dataset.original; }
}
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  let data;
  try { data = await response.json(); } catch { data = { error: "Server returned an unreadable response." }; }
  if (!response.ok) {
    const error = new Error(data.detail || data.error || data.title || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return { data, headers: response.headers };
}
function esc(value) {
  return String(value ?? "Not provided").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function pill(banned) {
  if (banned === true) return '<span class="status-pill status-banned">BANNED</span>';
  if (banned === false) return '<span class="status-pill status-clean">NOT BANNED</span>';
  return '<span class="status-pill status-unknown">UNKNOWN</span>';
}
function detail(label, value) {
  return `<div class="detail"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
}
function showError(target, error) {
  target.innerHTML = `<div class="result-card error-card"><strong>Request could not be completed</strong><p>${esc(error.message)}</p>${error.data?.requestId ? `<small>Request ID: ${esc(error.data.requestId)}</small>` : ""}</div>`;
}
function rateLine(headers) {
  const limit = headers.get("x-ratelimit-limit");
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  if (limit === null && remaining === null && reset === null) return "";
  return `<div class="rate-line">RATE LIMIT · ${esc(remaining ?? "—")} REMAINING / ${esc(limit ?? "—")}${reset ? ` · RESET ${esc(reset)}` : ""}</div>`;
}
function addHistory(number, banned, label) {
  state.checks++;
  if (banned === true) state.banned++;
  if (banned === false) state.clean++;
  state.history.unshift({ number, banned, label, time: new Date().toLocaleTimeString() });
  state.history = state.history.slice(0, 30);
  renderStats(); renderHistory();
}
function renderStats() {
  $("#statChecks").textContent = state.checks;
  $("#statBanned").textContent = state.banned;
  $("#statClean").textContent = state.clean;
}
function renderHistory() {
  const el = $("#historyList");
  if (!state.history.length) { el.innerHTML = '<div class="empty-state">Your recent checks will appear here.</div>'; return; }
  el.innerHTML = state.history.map(item => `<div class="history-row"><div><strong>${esc(item.number)}</strong><small>${esc(item.label)} · ${esc(item.time)}</small></div>${pill(item.banned)}</div>`).join("");
}
function renderSingle(data, headers, number) {
  const target = $("#singleResult");
  const banned = typeof data.banned === "boolean" ? data.banned : null;
  const statusLabel = banned === true ? "Banned" : banned === false ? "Not banned" : "Unknown";
  target.innerHTML = `<div class="result-card"><div class="result-top"><strong>${esc(number)}</strong>${pill(banned)}</div><div class="detail-grid">${detail("Ban type", data.ban_type || "Not provided")}${detail("Moderator ban", data.mod_ban === true ? "Yes" : data.mod_ban === false ? "No" : "Not provided")}${detail("Violation", data.violation_label || data.message || "Not provided")}${detail("Category", data.violation_category || "Not provided")}${detail("Reason", data.violation_reason || data.reason || "Not provided")}${detail("Appeal available", data.in_app_ban_appeal === true ? "Yes" : data.in_app_ban_appeal === false ? "No" : "Not provided")}${detail("EU indicator", typeof data.is_eu === "boolean" ? (data.is_eu ? "Yes" : "No") : "Not provided")}</div>${rateLine(headers)}</div>`;
  addHistory(number, banned, statusLabel);
}
$("#singleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const number = normalizePhone($("#singleNumber").value);
  const target = $("#singleResult"), button = event.submitter;
  if (!phoneIsValid(number)) return toast("Enter a valid international number, including + and country code.");
  setLoading(button, true);
  target.innerHTML = '<div class="loading">Contacting the checker…</div>';
  try {
    const result = await api("/api/check", { method: "POST", body: JSON.stringify({ number }) });
    renderSingle(result.data, result.headers, number);
  } catch (error) { showError(target, error); }
  finally { setLoading(button, false); }
});
$("#bulkNumbers").addEventListener("input", () => {
  const count = $("#bulkNumbers").value.split(/\r?\n/).map(s => s.trim()).filter(Boolean).length;
  $("#bulkCount").textContent = `${count} number${count === 1 ? "" : "s"} entered`;
});
$("#bulkForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const numbers = $("#bulkNumbers").value.split(/\r?\n/).map(normalizePhone).filter(Boolean);
  const target = $("#bulkResult"), button = event.submitter;
  if (!numbers.length) return toast("Enter at least one number.");
  setLoading(button, true);
  target.innerHTML = '<div class="loading">Checking submitted numbers…</div>';
  try {
    const { data, headers } = await api("/api/bulk-check", { method: "POST", body: JSON.stringify({ numbers }) });
    const results = Array.isArray(data.results) ? data.results : [];
    target.innerHTML = `<div class="result-card"><div class="result-top"><strong>Bulk results · ${results.length} returned</strong><button class="text-btn" id="exportCsv">Export CSV</button></div><div class="table-wrap"><table><thead><tr><th>NUMBER</th><th>STATUS</th><th>DETAIL</th></tr></thead><tbody>${results.map(item => {
      const status = item.error === "invalid" ? "INVALID" : item.banned === true ? "BANNED" : item.banned === false ? "NOT BANNED" : "UNKNOWN";
      return `<tr><td>${esc(item.number)}</td><td>${esc(status)}</td><td>${esc(item.violation_label || item.message || item.error || item.ban_type || "—")}</td></tr>`;
    }).join("")}</tbody></table></div>${rateLine(headers)}</div>`;
    results.forEach(item => { if (item.error !== "invalid") addHistory(item.number, typeof item.banned === "boolean" ? item.banned : null, item.banned === true ? "Banned" : item.banned === false ? "Not banned" : "Unknown"); });
    $("#exportCsv").addEventListener("click", () => exportCsv(results));
  } catch (error) { showError(target, error); }
  finally { setLoading(button, false); }
});
function exportCsv(results) {
  const rows = [["number","status","ban_type","violation_label","error"], ...results.map(item => [item.number, item.error === "invalid" ? "INVALID" : item.banned === true ? "BANNED" : item.banned === false ? "NOT BANNED" : "UNKNOWN", item.ban_type || "", item.violation_label || "", item.error || ""])];
  const csv = rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = "changretta-ban-check-results.csv"; a.click(); URL.revokeObjectURL(url);
}
$("#appealForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const phone = normalizePhone($("#appealPhone").value), target = $("#appealResult"), button = event.submitter;
  if (!phoneIsValid(phone)) return toast("Enter a valid international number.");
  setLoading(button, true); target.innerHTML = '<div class="loading">Looking up appeal information…</div>';
  try {
    const { data } = await api(`/api/appeal-status?phone=${encodeURIComponent(phone)}`);
    target.innerHTML = `<div class="result-card"><div class="result-top"><strong>${esc(phone)}</strong><span class="status-pill status-banned">${esc(data.status || "APPEAL RECORD")}</span></div><div class="detail-grid">${detail("Ban type", data.ban_type || "Not provided")}${detail("Permanent", data.is_perma === true ? "Yes" : data.is_perma === false ? "No" : "Not provided")}${detail("Ban time (UTC)", data.ban_time || "Not provided")}${detail("Appeal created (UTC)", data.appeal_creation_time || "Not provided")}${detail("Reason", data.reason || "Not provided")}${detail("Reason URL", data.reason_url || "Not provided")}</div></div>`;
  } catch (error) { showError(target, error); }
  finally { setLoading(button, false); }
});
$("#submitForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const phone = normalizePhone($("#submitPhone").value), text = $("#appealText").value.trim(), isEu = $("#isEu").checked;
  const target = $("#submitResult"), button = $("#submitAppealBtn");
  if (!phoneIsValid(phone)) return toast("Enter a valid international number.");
  if (text.length < 10) return toast("Appeal message must be at least 10 characters.");
  if (!$("#confirmAppeal").checked) return toast("Confirm that you reviewed and authorize this submission.");
  const accepted = window.confirm(`Submit one appeal for ${phone}?\n\nThis sends your message to the connected live provider. Continue only if you own or are authorized to represent this account.`);
  if (!accepted) return;
  setLoading(button, true); target.innerHTML = '<div class="loading">Submitting your confirmed appeal…</div>';
  try {
    const { data } = await api("/api/appeal-submit", { method: "POST", body: JSON.stringify({ phone, text, isEu }) });
    target.innerHTML = `<div class="result-card success-card"><strong>Appeal submission accepted</strong><p>${esc(data.message || "The provider returned a successful submission response.")}</p><small>Keep any confirmation information supplied by the provider.</small></div>`;
    $("#appealText").value = ""; $("#confirmAppeal").checked = false;
  } catch (error) { showError(target, error); }
  finally { setLoading(button, false); }
});
document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item === button));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === `tab-${button.dataset.tab}`));
}));
$("#clearHistory").addEventListener("click", () => {
  state.history = []; state.checks = 0; state.banned = 0; state.clean = 0; renderStats(); renderHistory(); toast("Session history cleared.");
});
$("#themeBtn").addEventListener("click", () => document.body.classList.toggle("light"));
(async function loadEnvironment() {
  try {
    const { data } = await api("/api/config");
    envBadge.textContent = `ENV: ${String(data.environment || "unknown").toUpperCase()}`;
    $("#sandboxWarning").hidden = data.environment !== "sandbox";
    $("#submitAppealBtn").disabled = data.environment === "sandbox";
  } catch {
    envBadge.textContent = "ENV: CONFIG REQUIRED";
    $("#sandboxWarning").textContent = "Configure BANCHECK_API_URL and BANCHECK_API_KEY in Vercel before using live API features.";
  }
})();
