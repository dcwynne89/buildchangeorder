/* ============================================================
   change-order-app.js — BuildChangeOrder consumer site logic
   ============================================================ */

const GUEST_KEY_STORAGE = "bco_guest_key";
const API_BASE = "/api/v1";

async function getOrCreateGuestKey() {
  let key = localStorage.getItem(GUEST_KEY_STORAGE);
  if (key && key.startsWith("bco_")) return key;
  const email = `guest_${Date.now()}_${Math.random().toString(36).slice(2)}@buildchangeorder.co`;
  try {
    const res  = await fetch(`${API_BASE}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await res.json();
    if (data.success && data.api_key) { localStorage.setItem(GUEST_KEY_STORAGE, data.api_key); return data.api_key; }
  } catch (e) { console.warn("Guest key error:", e); }
  return null;
}

// ── State ─────────────────────────────────────────────────────
let lineItems    = [{ description: "", quantity: 1, rate: 0 }];
let accentColor  = "#7C3AED";
let isGenerating = false;
const $          = (id) => document.getElementById(id);

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toISOString().split("T")[0];
  $("coDate").value = today;

  renderLineItems();
  bindEvents();
  updateRunningTotal();
  updatePreview();
  getOrCreateGuestKey();
});

function bindEvents() {
  $("accentColor").addEventListener("input", (e) => { accentColor = e.target.value; $("accentColorHex").value = e.target.value; updatePreview(); });
  $("btnAddItem").addEventListener("click", () => { lineItems.push({ description: "", quantity: 1, rate: 0 }); renderLineItems(); updateRunningTotal(); updatePreview(); });
  $("btnDownload").addEventListener("click", downloadCO);
  $("btnImportQuote").addEventListener("click", () => $("importQuoteInput").click());
  $("importQuoteInput").addEventListener("change", (e) => { if (e.target.files[0]) importFromBuildQuote(e.target.files[0]); e.target.value = ""; });
  document.querySelectorAll("input, textarea, select").forEach((el) => {
    el.addEventListener("input", () => { updateRunningTotal(); updatePreview(); });
  });
  document.addEventListener("click", (e) => { if (e.target.classList.contains("toast")) e.target.classList.remove("show"); });
}

// ── Line Items ────────────────────────────────────────────────
function renderLineItems() {
  const container = $("lineItems");
  container.innerHTML = "";
  lineItems.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "line-item-row";
    row.innerHTML = `
      <input type="text"   class="li-desc" placeholder="Description" value="${escHtml(item.description)}" data-idx="${i}" data-field="description">
      <input type="number" class="li-qty"  placeholder="Qty" value="${item.quantity}" min="0" step="1" data-idx="${i}" data-field="quantity">
      <input type="number" class="li-rate" placeholder="Rate" value="${item.rate}" min="0" step="0.01" data-idx="${i}" data-field="rate">
      <span class="li-amount">${fmt((item.quantity||1)*(item.rate||0))}</span>
      <button class="btn-remove-item" data-idx="${i}" title="Remove">✕</button>
    `;
    container.appendChild(row);
  });
  container.querySelectorAll("input").forEach((el) => {
    el.addEventListener("input", (e) => {
      const idx = +e.target.dataset.idx, field = e.target.dataset.field;
      lineItems[idx][field] = field === "description" ? e.target.value : parseFloat(e.target.value) || 0;
      const amount = (lineItems[idx].quantity||1) * (lineItems[idx].rate||0);
      e.target.closest(".line-item-row").querySelector(".li-amount").textContent = fmt(amount);
      updateRunningTotal(); updatePreview();
    });
  });
  container.querySelectorAll(".btn-remove-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = +e.target.dataset.idx;
      if (lineItems.length > 1) { lineItems.splice(idx, 1); renderLineItems(); updateRunningTotal(); updatePreview(); }
    });
  });
}

// ── Running Total ─────────────────────────────────────────────
function calcTotals() {
  const coSubtotal     = lineItems.reduce((s, i) => s + (i.quantity||1) * (i.rate||0), 0);
  const taxRate        = parseFloat($("taxRate").value) || 0;
  const tax            = coSubtotal * (taxRate / 100);
  const coTotal        = coSubtotal + tax;
  const originalValue  = parseFloat($("originalValue").value) || 0;
  const previousCOs    = parseFloat($("previousCOs").value)   || 0;
  const newTotal       = originalValue + previousCOs + coTotal;
  return { coSubtotal, tax, taxRate, coTotal, originalValue, previousCOs, newTotal };
}

function updateRunningTotal() {
  const t = calcTotals();
  const cur = $("currency").value || "$";
  const f   = (n) => `${cur}${Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",")}`;
  $("rtOriginal").textContent = f(t.originalValue);
  $("rtPrevCOs").textContent  = f(t.previousCOs);
  $("rtPrevRow").style.display = t.previousCOs > 0 ? "flex" : "none";
  $("rtThisCO").textContent   = f(t.coTotal);
  $("rtNewTotal").textContent = f(t.newTotal);
}

// ── Live Preview ──────────────────────────────────────────────
function updatePreview() {
  $("previewBody").innerHTML = renderPreviewHTML();
}

function renderPreviewHTML() {
  const col = accentColor || "#7C3AED";
  const cur = $("currency").value || "$";
  const f   = (n) => `${cur}${Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",")}`;
  const t   = calcTotals();

  const reasonMap = { client_request:"Client Request", unforeseen:"Unforeseen Conditions", design_revision:"Design Revision", error_omission:"Error or Omission", owner_initiated:"Owner-Initiated", other:"Other" };0
  const reason = reasonMap[$("reason").value] || "Client Request";

  return `
    <div style="font-family:Inter,sans-serif;font-size:12px;color:#1a202c;padding:24px;background:#fff;min-height:500px;">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div>
          <div style="font-size:17px;font-weight:800;">${escHtml($("fromName").value) || "<span style='color:#aaa'>Your Company</span>"}</div>
          ${$("fromEmail").value ? `<div style="color:#718096;font-size:10px;">${escHtml($("fromEmail").value)}</div>` : ""}
          ${$("fromPhone").value ? `<div style="color:#718096;font-size:10px;">${escHtml($("fromPhone").value)}</div>` : ""}
        </div>
        <div style="text-align:right;">
          <div style="font-size:8px;font-weight:700;color:#718096;letter-spacing:2px;">CHANGE ORDER</div>
          <div style="font-size:22px;font-weight:800;color:${col};">#${escHtml($("coNumber").value||"CO-001")}</div>
          <div style="font-size:10px;color:#4a5568;">Date: ${$("coDate").value||""}</div>
          ${$("contractRef").value ? `<div style="font-size:9px;color:#718096;">Re: ${escHtml($("contractRef").value)}</div>` : ""}
        </div>
      </div>

      <div style="height:4px;background:${col};border-radius:2px;margin-bottom:14px;"></div>

      <!-- Parties -->
      <div style="display:flex;justify-content:space-between;margin-bottom:14px;">
        <div>
          <div style="font-size:7px;font-weight:700;color:${col};letter-spacing:1px;margin-bottom:2px;">SUBMITTED TO</div>
          <div style="font-weight:700;font-size:12px;">${escHtml($("toName").value)||"<span style='color:#aaa'>Client Name</span>"}</div>
          ${$("toAddress").value ? `<div style="font-size:10px;color:#718096;">${escHtml($("toAddress").value)}</div>` : ""}
        </div>
        ${$("projectName").value ? `<div style="text-align:right;"><div style="font-size:7px;font-weight:700;color:${col};letter-spacing:1px;margin-bottom:2px;">PROJECT</div><div style="font-weight:700;font-size:12px;">${escHtml($("projectName").value)}</div></div>` : ""}
      </div>

      <!-- Reason box -->
      <div style="background:#f7f7fb;border-left:3px solid ${col};padding:8px 10px;margin-bottom:14px;border-radius:0 4px 4px 0;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <div style="font-size:7px;font-weight:700;color:${col};letter-spacing:1px;">REASON FOR CHANGE</div>
          <div style="font-size:9px;font-weight:700;">${reason}</div>
        </div>
        ${$("description").value ? `<div style="font-size:9px;color:#4a5568;margin-top:4px;line-height:1.5;">${escHtml($("description").value)}</div>` : ""}
      </div>

      <!-- Line Items -->
      ${lineItems.filter(i=>i.description).length ? `
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
        <thead>
          <tr style="background:${col};color:#fff;">
            <th style="padding:5px 6px;text-align:left;font-size:8px;">DESCRIPTION</th>
            <th style="padding:5px 6px;text-align:center;font-size:8px;width:40px;">QTY</th>
            <th style="padding:5px 6px;text-align:right;font-size:8px;width:70px;">PRICE</th>
            <th style="padding:5px 6px;text-align:right;font-size:8px;width:70px;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.filter(i=>i.description).map((item,i)=>`
            <tr style="background:${i%2===0?"#f9f9f9":"#fff"};">
              <td style="padding:4px 6px;font-size:9px;">${escHtml(item.description)}</td>
              <td style="padding:4px 6px;text-align:center;font-size:9px;">${item.quantity||1}</td>
              <td style="padding:4px 6px;text-align:right;font-size:9px;">${f(item.rate)}</td>
              <td style="padding:4px 6px;text-align:right;font-size:9px;font-weight:700;">${f((item.quantity||1)*(item.rate||0))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>` : ""}

      <!-- Financial Impact -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
        <div style="width:230px;">
          <div style="font-size:7px;font-weight:700;color:${col};letter-spacing:1px;margin-bottom:6px;text-align:right;">FINANCIAL IMPACT</div>
          <div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 0;color:#718096;"><span>Original Contract</span><span>${f(t.originalValue)}</span></div>
          ${t.previousCOs > 0 ? `<div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 0;color:#718096;"><span>Previous COs</span><span>${f(t.previousCOs)}</span></div>` : ""}
          ${t.taxRate > 0 ? `<div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 0;color:#718096;"><span>This CO (incl. ${t.taxRate}% tax)</span><span>${f(t.coTotal)}</span></div>` : `<div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 0;color:#718096;"><span>This Change Order</span><span>${f(t.coTotal)}</span></div>`}
          <div style="border-top:2px solid ${col};margin:6px 0;"></div>
          <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px;color:${col};"><span>NEW CONTRACT TOTAL</span><span>${f(t.newTotal)}</span></div>
        </div>
      </div>

      ${parseInt($("daysAdded").value||0) !== 0 ? `<div style="background:#fffbeb;border:1px solid #f6e05e;border-radius:4px;padding:7px;font-size:9px;color:#744210;margin-bottom:10px;">📅 Schedule Impact: ${parseInt($("daysAdded").value)>0?"+":""}${$("daysAdded").value} days${$("newCompletionDate").value?` · New completion: ${$("newCompletionDate").value}`:""}</div>` : ""}

      ${$("notes").value ? `<div style="margin-bottom:8px;"><div style="font-size:7px;font-weight:700;color:${col};letter-spacing:1px;margin-bottom:3px;">NOTES</div><div style="font-size:9px;color:#4a5568;">${escHtml($("notes").value)}</div></div>` : ""}

      <!-- Signature Block -->
      <div style="display:flex;justify-content:space-between;margin-top:18px;">
        <div style="width:175px;"><div style="border-top:1px solid #ccc;padding-top:4px;font-size:8px;color:#999;">Client Approval · Signature · Date</div></div>
        <div style="width:175px;"><div style="border-top:1px solid #ccc;padding-top:4px;font-size:8px;color:#999;">Contractor Authorization · Signature · Date</div></div>
      </div>
    </div>
  `;
}

// ── Download ──────────────────────────────────────────────────
async function downloadCO() {
  if (isGenerating) return;
  if (!$("fromName").value) { showToast("Enter your company name.", "error"); return; }
  if (!$("toName").value)   { showToast("Enter the client name.", "error"); return; }
  if (lineItems.every(i => !i.description)) { showToast("Add at least one scope item.", "error"); return; }

  isGenerating = true;
  const btn = $("btnDownload");
  btn.disabled = true; btn.textContent = "⏳ Generating PDF…";

  try {
    const apiKey = await getOrCreateGuestKey();
    const t = calcTotals();
    const payload = {
      from: { name: $("fromName").value, email: $("fromEmail").value, phone: $("fromPhone").value },
      to:   { name: $("toName").value,   email: $("toEmail").value,   address: $("toAddress").value },
      change_order: { number: $("coNumber").value||"CO-001", date: $("coDate").value, project: $("projectName").value },
      original_contract: {
        reference:             $("contractRef").value,
        date:                  $("contractDate").value,
        value:                 t.originalValue,
        previous_change_orders: t.previousCOs,
      },
      items:       lineItems.filter(i => i.description),
      reason:      $("reason").value,
      description: $("description").value,
      impact: {
        days_added:          parseInt($("daysAdded").value) || 0,
        new_completion_date: $("newCompletionDate").value || undefined,
      },
      tax_rate: t.taxRate,
      notes:   $("notes").value,
      terms:   $("terms").value,
      options: { color: accentColor, currency_symbol: $("currency").value || "$" },
    };

    const res    = await fetch(`${API_BASE}/generate`, { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": apiKey || "guest" }, body: JSON.stringify(payload) });
    const result = await res.json();

    if (!result.success || !result.pdf) { showToast(result.error || "Generation failed.", "error"); return; }

    const bytes = atob(result.pdf);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob  = new Blob([arr], { type: "application/pdf" });
    const url   = URL.createObjectURL(blob);
    const link  = document.createElement("a");
    link.href   = url; link.download = `${($("coNumber").value||"CO-001").replace(/\s+/g,"-")}.pdf`;
    link.click(); URL.revokeObjectURL(url);
    showToast("✓ Change Order PDF downloaded!", "success");
  } catch (err) {
    console.error(err); showToast("Network error. Please try again.", "error");
  } finally {
    isGenerating = false; btn.disabled = false; btn.textContent = "⬇ Download Change Order PDF";
  }
}

// ── Import from BuildQuotes ───────────────────────────────────
function importFromBuildQuote(file) {
  if (file.name.endsWith(".pdf")) {
    showToast("Can't import PDFs. In BuildQuotes, click 'Export for BuildInvoice' to get a .buildquote file.", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target.result);
      if (json.type !== "buildquote") { showToast("Not a valid .buildquote file.", "error"); return; }
      const d = json.data || {};

      // Pre-fill Your Info
      if (d.company)      $("fromName").value  = d.company;
      if (d.email)        $("fromEmail").value = d.email;
      if (d.phone)        $("fromPhone").value = d.phone;

      // Pre-fill Client Info
      if (d.client_name)  $("toName").value    = d.client_name;
      if (d.client_email) $("toEmail").value   = d.client_email;

      // Project name from quote
      if (d.project_name) $("projectName").value = d.project_name;

      // Set CO number from quote number  (Q-001 → CO-001)
      if (d.quote_number) $("coNumber").value = d.quote_number.replace(/^Q(?:TE)?-?/i, "CO-");

      // Import line items
      if (Array.isArray(d.line_items) && d.line_items.length) {
        lineItems = d.line_items.map(li => ({
          description: li.description || "",
          quantity:    parseFloat(li.quantity) || 1,
          rate:        parseFloat(li.rate)     || 0,
        }));
        renderLineItems();
      }

      // Tax rate
      if (d.tax_rate != null) $("taxRate").value = d.tax_rate;

      // Set original contract value = quote total (subtotal+tax) — user can adjust
      const sub  = (d.subtotal || 0);
      const tax  = sub * ((d.tax_rate || 0) / 100);
      $("originalValue").value = (sub + tax).toFixed(2);

      // Notes/Terms
      if (d.notes)  $("notes").value  = d.notes;
      if (d.terms)  $("terms").value  = d.terms;

      updateRunningTotal();
      updatePreview();
      showToast("✓ Quote imported! Review and adjust values before downloading.", "success");
    } catch {
      showToast("Could not read file. Make sure it's a valid .buildquote file.", "error");
    }
  };
  reader.readAsText(file);
}

// ── Helpers ───────────────────────────────────────────────────
function fmt(n) { const cur=$("currency")?.value||"$"; return `${cur}${Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",")}`; }
function escHtml(s) { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function showToast(msg, type="success") { const t=$("toast"); t.textContent=msg; t.className=`toast toast--${type} show`; setTimeout(()=>t.classList.remove("show"),4000); }
