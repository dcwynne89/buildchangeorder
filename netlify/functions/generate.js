/* ============================================================
   generate.js — Change Order generation endpoint
   POST /api/v1/generate
   ============================================================ */

const { authenticate, jsonResponse, errorResponse } = require("./utils/auth");
const { incrementUsage, MAX_BODY_BYTES } = require("./utils/storage");
const modernTemplate = require("./utils/templates/modern");

exports.handler = async (event) => {
  const { auth, response } = await authenticate(event, { countUsage: true });
  if (response) return response;
  if (event.httpMethod !== "POST") return errorResponse(405, "Use POST.");
  if (event.body && Buffer.byteLength(event.body, "utf-8") > MAX_BODY_BYTES) return errorResponse(413, "Request body too large.");

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return errorResponse(400, "Invalid JSON body."); }

  const {
    from, to, change_order = {}, original_contract = {},
    items = [], reason, description, impact = {},
    tax_rate = 0, notes, terms, options = {},
  } = body;

  // Validation
  if (!from?.name) return errorResponse(400, "Missing 'from.name'.");
  if (!to?.name)   return errorResponse(400, "Missing 'to.name'.");
  if (!change_order.number) change_order.number = "CO-001";

  // Validate items
  for (let i = 0; i < items.length; i++) {
    if (!items[i].description) return errorResponse(400, `Item ${i+1} missing 'description'.`);
    if (typeof items[i].rate !== "number") return errorResponse(400, `Item ${i+1} has invalid 'rate'.`);
    if (items[i].quantity == null) items[i].quantity = 1;
  }

  // Calculate totals — the core differentiator
  const coSubtotal      = items.reduce((s, i) => s + (i.quantity || 1) * (i.rate || 0), 0);
  const taxAmount       = coSubtotal * (tax_rate / 100);
  const coTotal         = coSubtotal + taxAmount;
  const previousCOs     = Number(original_contract.previous_change_orders || 0);
  const originalValue   = Number(original_contract.value || 0);
  const newContractTotal = originalValue + previousCOs + coTotal;

  const totals = {
    co_subtotal:        round2(coSubtotal),
    tax:                round2(taxAmount),
    tax_rate,
    change_order_total: round2(coTotal),
    previous_cos:       round2(previousCOs),
    new_contract_total: round2(newContractTotal),
  };

  const templateOpts = {
    color:           options.color           || "#7C3AED",
    pageSize:        options.pageSize        || "LETTER",
    currency_symbol: options.currency_symbol || "$",
    watermark:       auth.tier.watermark,
  };

  try {
    const docDef   = modernTemplate({ from, to, change_order, original_contract, items, reason, description, impact, notes, terms, totals }, templateOpts);
    const pdfBuf   = await renderPdf(docDef);
    await incrementUsage(auth.hash);

    return jsonResponse(200, {
      success:       true,
      pdf:           pdfBuf.toString("base64"),
      pages:         countPages(pdfBuf),
      size_bytes:    pdfBuf.length,
      co_number:     change_order.number,
      totals,
      watermark:     auth.tier.watermark,
      usage: {
        used:      auth.quota.used + 1,
        limit:     auth.quota.limit,
        remaining: auth.quota.remaining - 1,
      },
      powered_by: "https://buildchangeorder.co",
    });
  } catch (err) {
    console.error("Generation error:", err);
    return errorResponse(500, "Change order generation failed.");
  }
};

async function renderPdf(docDefinition) {
  const PdfPrinter = require("pdfmake/src/printer");
  const vfsData    = require("pdfmake/build/vfs_fonts");
  const fonts = {
    Roboto: {
      normal:      Buffer.from(vfsData["Roboto-Regular.ttf"],       "base64"),
      bold:        Buffer.from(vfsData["Roboto-Medium.ttf"],        "base64"),
      italics:     Buffer.from(vfsData["Roboto-Italic.ttf"],        "base64"),
      bolditalics: Buffer.from(vfsData["Roboto-MediumItalic.ttf"],  "base64"),
    },
  };
  const printer = new PdfPrinter(fonts);
  const pdfDoc  = printer.createPdfKitDocument(docDefinition);
  return new Promise((resolve, reject) => {
    const chunks = [];
    pdfDoc.on("data",  c => chunks.push(c));
    pdfDoc.on("end",   () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}

function countPages(buf) {
  const m = buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g);
  return m ? m.length : 1;
}

function round2(n) { return Math.round(n * 100) / 100; }
