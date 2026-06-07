/* ============================================================
   BuildChangeOrder — Save/Load Integration
   Connects the change order form to BuildAuth for persistence.
   
   Requires: build-ecosystem-auth.js loaded first
   ============================================================ */
(function () {
  "use strict";

  // Wait for BuildAuth to exist
  function waitForAuth(cb) {
    if (window.BuildAuth) { cb(); return; }
    var t = setInterval(function () {
      if (window.BuildAuth) { clearInterval(t); cb(); }
    }, 200);
  }

  waitForAuth(function () { init(); });

  /* ── Autocomplete CSS ─────────────────────────────────────── */
  var acStyle = document.createElement("style");
  acStyle.textContent = `
    .bco-ac-wrap { position: relative; }
    .bco-ac-list {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 500;
      background: #1a1d2e; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px; margin-top: 4px; max-height: 200px;
      overflow-y: auto; display: none;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .bco-ac-list.open { display: block; }
    .bco-ac-item {
      padding: 10px 14px; cursor: pointer; transition: background 0.12s;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .bco-ac-item:last-child { border-bottom: none; }
    .bco-ac-item:hover, .bco-ac-item.active { background: rgba(245,158,11,0.1); }
    .bco-ac-name { font-size: 0.9rem; font-weight: 600; color: rgba(255,255,255,0.85); }
    .bco-ac-detail { font-size: 0.75rem; color: rgba(255,255,255,0.35); margin-top: 1px; }
    .bco-ac-badge {
      display: inline-block; font-size: 0.65rem; padding: 1px 6px;
      background: rgba(245,158,11,0.15); color: #fbbf24;
      border-radius: 4px; margin-left: 6px; vertical-align: middle;
    }
  `;
  document.head.appendChild(acStyle);

  /* ── Read form state from DOM ─────────────────────────────── */

  function readFormData() {
    var items = [];
    document.querySelectorAll("#lineItems .line-item-row").forEach(function (row) {
      var desc = row.querySelector(".li-desc");
      var qty  = row.querySelector(".li-qty");
      var rate = row.querySelector(".li-rate");
      if (desc) {
        items.push({
          description: desc.value || "",
          quantity: parseFloat(qty?.value) || 1,
          rate: parseFloat(rate?.value) || 0,
        });
      }
    });

    return {
      from_name:        v("fromName"),
      from_email:       v("fromEmail"),
      from_street:      v("fromStreet"),
      from_city:        v("fromCity"),
      from_state:       v("fromState"),
      from_phone:       v("fromPhone"),
      accent_color:     v("accentColor"),
      to_name:          v("toName"),
      to_email:         v("toEmail"),
      to_address:       v("toAddress"),
      co_number:        v("coNumber"),
      co_date:          v("coDate"),
      project:          v("projectName"),
      currency:         v("currency"),
      reason:           v("reason"),
      description:      v("description"),
      contract_ref:     v("contractRef"),
      contract_date:    v("contractDate"),
      original_value:   parseFloat(v("originalValue")) || 0,
      previous_cos:     parseFloat(v("previousCOs")) || 0,
      days_added:       parseInt(v("daysAdded"), 10) || 0,
      new_completion:   v("newCompletionDate"),
      tax_rate:         parseFloat(v("taxRate")) || 0,
      notes:            v("notes"),
      terms:            v("terms"),
      line_items:       items,
    };
  }

  function v(id) { var el = document.getElementById(id); return el ? el.value : ""; }

  /* ── Write form state to DOM ──────────────────────────────── */

  function loadFormData(data) {
    setVal("fromName",          data.from_name);
    setVal("fromEmail",         data.from_email);
    setVal("fromStreet",        data.from_street);
    setVal("fromCity",          data.from_city);
    setVal("fromState",         data.from_state);
    setVal("fromPhone",         data.from_phone);
    setVal("toName",            data.to_name);
    setVal("toEmail",           data.to_email);
    setVal("toAddress",         data.to_address);
    setVal("coNumber",          data.co_number);
    setVal("coDate",            data.co_date);
    setVal("projectName",       data.project);
    setVal("currency",          data.currency);
    setVal("reason",            data.reason);
    setVal("description",       data.description);
    setVal("contractRef",       data.contract_ref);
    setVal("contractDate",      data.contract_date);
    setVal("originalValue",     data.original_value);
    setVal("previousCOs",       data.previous_cos);
    setVal("daysAdded",         data.days_added);
    setVal("newCompletionDate", data.new_completion);
    setVal("taxRate",           data.tax_rate);
    setVal("notes",             data.notes);
    setVal("terms",             data.terms);

    if (data.accent_color) {
      setVal("accentColor", data.accent_color);
      setVal("accentColorHex", data.accent_color);
      if (window.accentColor !== undefined) window.accentColor = data.accent_color;
    }

    // Rebuild line items
    if (data.line_items && data.line_items.length > 0) {
      var container = document.getElementById("lineItems");
      if (container) {
        var rows = container.querySelectorAll(".line-item-row");
        rows.forEach(function (r) { r.remove(); });

        data.line_items.forEach(function (item, idx) {
          var addBtn = document.querySelector(".btn-add-item");
          if (addBtn && idx > 0) addBtn.click();
        });

        setTimeout(function () {
          var newRows = container.querySelectorAll(".line-item-row");
          data.line_items.forEach(function (item, idx) {
            if (newRows[idx]) {
              var desc = newRows[idx].querySelector(".li-desc");
              var qty  = newRows[idx].querySelector(".li-qty");
              var rate = newRows[idx].querySelector(".li-rate");
              if (desc) { desc.value = item.description; desc.dispatchEvent(new Event("input", { bubbles: true })); }
              if (qty)  { qty.value = item.quantity; qty.dispatchEvent(new Event("input", { bubbles: true })); }
              if (rate) { rate.value = item.rate; rate.dispatchEvent(new Event("input", { bubbles: true })); }
            }
          });
        }, 100);
      }

      if (window.lineItems !== undefined) {
        window.lineItems = data.line_items.map(function (it) {
          return { description: it.description || "", quantity: it.quantity || 1, rate: it.rate || 0 };
        });
      }
      if (typeof window.renderLineItems === "function") window.renderLineItems();
      if (typeof window.calcTotals === "function") window.calcTotals();
    }

    // Trigger reason select change
    var reasonEl = document.getElementById("reason");
    if (reasonEl) reasonEl.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setVal(id, val) {
    var el = document.getElementById(id);
    if (el && val !== undefined && val !== null) {
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  /* ── Build title from form data ───────────────────────────── */

  function buildTitle(data) {
    var parts = [];
    if (data.co_number) parts.push(data.co_number);
    if (data.to_name) parts.push("for " + data.to_name);
    if (data.project) parts.push("— " + data.project);
    return parts.join(" ") || "Untitled Change Order";
  }

  /* ── Compute total from line items ────────────────────────── */

  function computeTotal(data) {
    var sub = 0;
    (data.line_items || []).forEach(function (it) { sub += (it.quantity || 0) * (it.rate || 0); });
    var tax = sub * ((data.tax_rate || 0) / 100);
    return sub + tax;
  }

  /* ── Inject UI ────────────────────────────────────────────── */

  function init() {
    injectSaveButton();
    injectSavedPanel();
    initClientAutocomplete();

    BuildAuth.onAuthChange(function (user) {
      var panel = document.getElementById("bco-saved-panel");
      var saveBtn = document.getElementById("bco-save-btn");
      var hint = document.getElementById("bco-save-hint");

      if (user) {
        if (saveBtn) saveBtn.style.display = "";
        if (hint) hint.style.display = "none";
        if (panel) { panel.style.display = ""; loadSavedCOs(); }
      } else {
        if (saveBtn) saveBtn.style.display = "none";
        if (hint) hint.style.display = "";
        if (panel) panel.style.display = "none";
      }
    });
  }

  function injectSaveButton() {
    var btnRow = document.getElementById("btnDownload")?.parentElement;
    if (!btnRow) return;

    // Save button (hidden until signed in)
    var saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.id = "bco-save-btn";
    saveBtn.style.cssText = "display:none;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);color:#fbbf24;padding:0.75rem 1.25rem;border-radius:12px;font-weight:600;font-size:0.95rem;cursor:pointer;transition:all 0.2s;white-space:nowrap;font-family:inherit;";
    saveBtn.textContent = "💾 Save";
    saveBtn.title = "Save this change order to your account";
    saveBtn.addEventListener("mouseenter", function () { saveBtn.style.background = "rgba(245,158,11,0.25)"; });
    saveBtn.addEventListener("mouseleave", function () { saveBtn.style.background = "rgba(245,158,11,0.15)"; });
    saveBtn.addEventListener("click", handleSave);
    btnRow.appendChild(saveBtn);

    // "Sign in to save" hint (shown when signed out)
    var hint = document.createElement("button");
    hint.type = "button";
    hint.id = "bco-save-hint";
    hint.className = "bea-save-hint";
    hint.textContent = "💾 Sign in to save your change orders";
    hint.style.marginTop = "0.75rem";
    hint.addEventListener("click", function () { BuildAuth.showSignIn(); });
    btnRow.parentElement.appendChild(hint);
  }

  async function handleSave() {
    var btn = document.getElementById("bco-save-btn");
    btn.textContent = "Saving...";
    btn.disabled = true;

    var data = readFormData();
    var title = buildTitle(data);
    var total = computeTotal(data);

    // Also save client to shared clients collection
    if (data.to_name) {
      BuildAuth.saveClient({
        name: data.to_name,
        email: data.to_email || "",
        phone: "",
        address: data.to_address || "",
      });
    }

    var docId = await BuildAuth.saveDocument("change_order", title, data, {
      clientName: data.to_name,
      total: total,
      status: "draft",
    });

    if (docId) {
      btn.textContent = "✓ Saved";
      setTimeout(function () { btn.textContent = "💾 Save"; btn.disabled = false; }, 2000);
      loadSavedCOs();
    } else {
      btn.textContent = "✗ Error";
      setTimeout(function () { btn.textContent = "💾 Save"; btn.disabled = false; }, 2000);
    }
  }

  /* ── Saved Change Orders Panel ────────────────────────────── */

  function injectSavedPanel() {
    var form = document.querySelector(".form-panel, .form-card, #formPanel");
    if (!form) form = document.querySelector("main") || document.querySelector(".container");
    if (!form) return;

    var panel = document.createElement("div");
    panel.id = "bco-saved-panel";
    panel.style.cssText = "display:none;margin-bottom:2rem;background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.12);border-radius:16px;padding:1.5rem;";
    panel.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">' +
        '<h3 style="margin:0;font-size:1rem;font-weight:700;color:rgba(255,255,255,0.85);">📋 Your Saved Change Orders</h3>' +
        '<button id="bco-refresh" style="background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:0.85rem;">↻ Refresh</button>' +
      '</div>' +
      '<div id="bco-list" style="display:flex;flex-direction:column;gap:0.5rem;"></div>';

    form.parentElement.insertBefore(panel, form);

    document.getElementById("bco-refresh")?.addEventListener("click", loadSavedCOs);
  }

  async function loadSavedCOs() {
    var list = document.getElementById("bco-list");
    if (!list) return;

    list.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:0.85rem;">Loading...</div>';

    var docs = await BuildAuth.loadDocuments("change_order");

    if (docs.length === 0) {
      list.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:0.85rem;">No saved change orders yet. Create a change order and click 💾 Save.</div>';
      return;
    }

    list.innerHTML = "";
    docs.forEach(function (doc) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;cursor:pointer;transition:all 0.15s;";
      row.addEventListener("mouseenter", function () { row.style.background = "rgba(255,255,255,0.06)"; });
      row.addEventListener("mouseleave", function () { row.style.background = "rgba(255,255,255,0.03)"; });

      var info = document.createElement("div");
      info.innerHTML =
        '<div style="font-size:0.9rem;font-weight:600;color:rgba(255,255,255,0.8);">' + escHtml(doc.title) + '</div>' +
        '<div style="font-size:0.75rem;color:rgba(255,255,255,0.35);margin-top:2px;">' +
          (doc.clientName ? escHtml(doc.clientName) + " · " : "") +
          (doc.total ? "$" + doc.total.toFixed(2) + " · " : "") +
          formatDate(doc.createdAt) +
        '</div>';

      var actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:6px;flex-shrink:0;";

      var loadBtn = document.createElement("button");
      loadBtn.style.cssText = "background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.25);color:#fbbf24;padding:5px 12px;border-radius:8px;font-size:0.8rem;cursor:pointer;font-family:inherit;";
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", function (e) { e.stopPropagation(); loadCO(doc.id); });

      var delBtn = document.createElement("button");
      delBtn.style.cssText = "background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#f87171;padding:5px 10px;border-radius:8px;font-size:0.8rem;cursor:pointer;font-family:inherit;";
      delBtn.textContent = "✕";
      delBtn.title = "Delete";
      delBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (confirm("Delete this saved change order?")) {
          BuildAuth.deleteDocument(doc.id).then(function () { loadSavedCOs(); });
        }
      });

      actions.appendChild(loadBtn);
      actions.appendChild(delBtn);
      row.appendChild(info);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  async function loadCO(docId) {
    var doc = await BuildAuth.getDocument(docId);
    if (!doc || !doc.formData) { alert("Could not load change order."); return; }
    loadFormData(doc.formData);
    // Scroll to form
    var form = document.querySelector(".form-panel, .form-card, #formPanel, main");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ── Client Autocomplete ───────────────────────────────────── */

  var cachedClients = [];
  var acList = null;
  var acActiveIdx = -1;

  function initClientAutocomplete() {
    var nameInput = document.getElementById("toName");
    if (!nameInput) return;

    // Wrap input for positioning
    var parent = nameInput.parentElement;
    parent.style.position = "relative";

    // Create dropdown
    acList = document.createElement("div");
    acList.className = "bco-ac-list";
    acList.id = "bco-ac-list";
    parent.appendChild(acList);

    nameInput.addEventListener("input", function () {
      if (!BuildAuth.getUser()) return;
      var query = nameInput.value.trim().toLowerCase();
      if (query.length < 1) { closeAc(); return; }
      showMatches(query);
    });

    nameInput.addEventListener("focus", function () {
      if (!BuildAuth.getUser()) return;
      var query = nameInput.value.trim().toLowerCase();
      if (query.length >= 1) showMatches(query);
    });

    nameInput.addEventListener("keydown", function (e) {
      if (!acList.classList.contains("open")) return;
      var items = acList.querySelectorAll(".bco-ac-item");
      if (e.key === "ArrowDown") { e.preventDefault(); acActiveIdx = Math.min(acActiveIdx + 1, items.length - 1); highlightAc(items); }
      else if (e.key === "ArrowUp") { e.preventDefault(); acActiveIdx = Math.max(acActiveIdx - 1, 0); highlightAc(items); }
      else if (e.key === "Enter" && acActiveIdx >= 0) { e.preventDefault(); items[acActiveIdx]?.click(); }
      else if (e.key === "Escape") { closeAc(); }
    });

    document.addEventListener("click", function (e) {
      if (!acList.contains(e.target) && e.target !== nameInput) closeAc();
    });

    // Load clients when user signs in
    BuildAuth.onAuthChange(function (user) {
      if (user) refreshClients();
      else { cachedClients = []; closeAc(); }
    });
  }

  async function refreshClients() {
    cachedClients = await BuildAuth.loadClients();
  }

  function showMatches(query) {
    var matches = cachedClients.filter(function (c) {
      return (c.name || "").toLowerCase().indexOf(query) !== -1;
    }).slice(0, 6);

    if (matches.length === 0) { closeAc(); return; }

    acActiveIdx = -1;
    acList.innerHTML = "";
    matches.forEach(function (client, idx) {
      var item = document.createElement("div");
      item.className = "bco-ac-item";
      var products = (client.usedIn || []).map(function (p) {
        return '<span class="bco-ac-badge">' + escHtml(p) + '</span>';
      }).join("");
      item.innerHTML =
        '<div class="bco-ac-name">' + escHtml(client.name) + products + '</div>' +
        (client.email ? '<div class="bco-ac-detail">' + escHtml(client.email) + (client.address ? ' · ' + escHtml(client.address) : '') + '</div>' : '');

      item.addEventListener("click", function () { selectClient(client); });
      acList.appendChild(item);
    });
    acList.classList.add("open");
  }

  function selectClient(client) {
    setVal("toName", client.name);
    if (client.email) setVal("toEmail", client.email);
    if (client.address) setVal("toAddress", client.address);
    closeAc();
  }

  function highlightAc(items) {
    items.forEach(function (it, i) {
      it.classList.toggle("active", i === acActiveIdx);
    });
  }

  function closeAc() {
    if (acList) { acList.classList.remove("open"); acList.innerHTML = ""; }
    acActiveIdx = -1;
  }

  /* ── Helpers ──────────────────────────────────────────────── */

  function escHtml(str) {
    var d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  function formatDate(ts) {
    if (!ts) return "";
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
})();
