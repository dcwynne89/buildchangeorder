/* ============================================================
   modern.js — Change Order PDF template
   The killer feature: running contract total
   ============================================================ */

module.exports = function modernChangeOrder(data, opts = {}) {
  const color    = opts.color           || "#7C3AED";
  const cur      = opts.currency_symbol || "$";
  const watermark = opts.watermark;

  const {
    from, to, change_order, original_contract,
    items, reason, description, impact,
    notes, terms, totals,
  } = data;

  const fmt = (n) => `${cur}${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const hex2rgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };
  const [cr, cg, cb] = hex2rgb(color);
  const lightColor = `rgb(${Math.min(cr+180,255)},${Math.min(cg+180,255)},${Math.min(cb+180,255)})`;

  const reasonLabels = {
    client_request:     "Client Request",
    unforeseen:         "Unforeseen Conditions",
    design_revision:    "Design Revision",
    error_omission:     "Error or Omission",
    owner_initiated:    "Owner-Initiated",
    other:              "Other",
  };

  // Build line items table rows
  const itemRows = (items || []).map((item, i) => [
    { text: item.description || "", fontSize: 9, color: "#1a202c" },
    { text: String(item.quantity || 1), alignment: "center", fontSize: 9 },
    { text: fmt(item.rate), alignment: "right", fontSize: 9 },
    { text: fmt((item.quantity || 1) * (item.rate || 0)), alignment: "right", fontSize: 9, bold: true },
  ]);

  const scheduleRows = [];
  if (impact?.days_added && impact.days_added !== 0) {
    const sign = impact.days_added > 0 ? "+" : "";
    scheduleRows.push(
      { text: `Schedule Impact: ${sign}${impact.days_added} day${Math.abs(impact.days_added) !== 1 ? "s" : ""}`, fontSize: 9, color: impact.days_added > 0 ? "#c05621" : "#276749", bold: true, margin: [0, 2, 0, 0] }
    );
    if (impact.new_completion_date) {
      scheduleRows.push({ text: `New Completion Date: ${impact.new_completion_date}`, fontSize: 9, color: "#4a5568" });
    }
  }

  const content = [
    // ── HEADER ────────────────────────────────────────────────
    {
      columns: [
        {
          stack: [
            { text: from?.name || "", fontSize: 16, bold: true, color: "#1a202c" },
            from?.address ? { text: from.address, fontSize: 9, color: "#718096", margin: [0, 2, 0, 0] } : {},
            from?.email   ? { text: from.email,   fontSize: 9, color: "#718096" } : {},
            from?.phone   ? { text: from.phone,   fontSize: 9, color: "#718096" } : {},
          ],
        },
        {
          stack: [
            { text: "CHANGE ORDER", fontSize: 8, bold: true, color: "#718096", letterSpacing: 2, alignment: "right" },
            { text: `#${change_order?.number || "CO-001"}`, fontSize: 22, bold: true, color, alignment: "right" },
            { text: `Date: ${change_order?.date || ""}`, fontSize: 9, color: "#4a5568", alignment: "right" },
            original_contract?.reference ? { text: `Re: ${original_contract.reference}`, fontSize: 9, color: "#4a5568", alignment: "right" } : {},
            original_contract?.date ? { text: `Contract Date: ${original_contract.date}`, fontSize: 9, color: "#4a5568", alignment: "right" } : {},
          ],
          width: 200,
        },
      ],
      margin: [0, 0, 0, 12],
    },

    // ── ACCENT RULE ───────────────────────────────────────────
    { canvas: [{ type: "rect", x: 0, y: 0, w: 515, h: 4, r: 2, color }], margin: [0, 0, 0, 14] },

    // ── PARTIES ───────────────────────────────────────────────
    {
      columns: [
        {
          stack: [
            { text: "SUBMITTED BY", fontSize: 7, bold: true, color, letterSpacing: 1 },
            { text: from?.name || "", fontSize: 11, bold: true, margin: [0, 2, 0, 0] },
          ],
        },
        {
          stack: [
            { text: "SUBMITTED TO", fontSize: 7, bold: true, color, letterSpacing: 1 },
            { text: to?.name || "", fontSize: 11, bold: true, margin: [0, 2, 0, 0] },
            to?.address ? { text: to.address, fontSize: 9, color: "#718096" } : {},
            to?.email   ? { text: to.email,   fontSize: 9, color: "#718096" } : {},
          ],
        },
        change_order?.project ? {
          stack: [
            { text: "PROJECT", fontSize: 7, bold: true, color, letterSpacing: 1 },
            { text: change_order.project, fontSize: 11, bold: true, margin: [0, 2, 0, 0] },
          ],
        } : {},
      ],
      margin: [0, 0, 0, 14],
    },

    // ── REASON & DESCRIPTION ──────────────────────────────────
    {
      table: {
        widths: ["*"],
        body: [[
          {
            stack: [
              {
                columns: [
                  { text: "REASON FOR CHANGE", fontSize: 7, bold: true, color, letterSpacing: 1 },
                  { text: reasonLabels[reason] || reason || "—", fontSize: 9, bold: true, alignment: "right", color: "#1a202c" },
                ],
                margin: [0, 0, 0, 4],
              },
              description ? { text: description, fontSize: 9, color: "#4a5568", lineHeight: 1.5 } : {},
            ],
            fillColor: "#f7f7fb",
            margin: [10, 8, 10, 8],
            border: [false, false, false, false],
          },
        ]],
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 0,
        hLineColor: () => color,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
      margin: [0, 0, 0, 14],
    },

    // ── LINE ITEMS ────────────────────────────────────────────
    items?.length ? {
      table: {
        headerRows: 1,
        widths: ["*", 45, 75, 75],
        body: [
          [
            { text: "DESCRIPTION",  fontSize: 8, bold: true, color: "#fff", fillColor: color, margin: [4, 5, 4, 5] },
            { text: "QTY",          fontSize: 8, bold: true, color: "#fff", fillColor: color, alignment: "center", margin: [4, 5, 4, 5] },
            { text: "UNIT PRICE",   fontSize: 8, bold: true, color: "#fff", fillColor: color, alignment: "right",  margin: [4, 5, 4, 5] },
            { text: "AMOUNT",       fontSize: 8, bold: true, color: "#fff", fillColor: color, alignment: "right",  margin: [4, 5, 4, 5] },
          ],
          ...itemRows.map((row, i) => row.map(cell => ({
            ...cell, fillColor: i % 2 === 0 ? "#f9f9f9" : "#ffffff",
            margin: [4, 4, 4, 4],
          }))),
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 14],
    } : {},

    // ── FINANCIAL IMPACT ──────────────────────────────────────
    {
      columns: [
        {
          stack: scheduleRows.length ? scheduleRows : [{ text: "" }],
          width: "*",
        },
        {
          stack: [
            { text: "FINANCIAL IMPACT", fontSize: 7, bold: true, color, letterSpacing: 1, alignment: "right", margin: [0, 0, 0, 6] },
            {
              table: {
                widths: ["*", 90],
                body: [
                  [
                    { text: "Original Contract Value", fontSize: 9, color: "#4a5568", border: [false,false,false,false] },
                    { text: fmt(original_contract?.value || 0), fontSize: 9, alignment: "right", border: [false,false,false,false] },
                  ],
                  ...(totals.previous_cos > 0 ? [[
                    { text: "Previous Change Orders", fontSize: 9, color: "#4a5568", border: [false,false,false,false] },
                    { text: fmt(totals.previous_cos), fontSize: 9, alignment: "right", border: [false,false,false,false] },
                  ]] : []),
                  [
                    { text: `This Change Order${totals.tax_rate > 0 ? ` (${totals.tax_rate}% tax)` : ""}`, fontSize: 9, color: "#4a5568", border: [false,false,false,false] },
                    { text: fmt(totals.change_order_total), fontSize: 9, alignment: "right", border: [false,false,false,false] },
                  ],
                  [
                    { text: "NEW CONTRACT TOTAL", fontSize: 10, bold: true, color, border: [false,true,false,false], borderColor: [null, color, null, null], margin: [0, 6, 0, 0] },
                    { text: fmt(totals.new_contract_total), fontSize: 10, bold: true, color, alignment: "right", border: [false,true,false,false], borderColor: [null, color, null, null], margin: [0, 6, 0, 0] },
                  ],
                ],
              },
              layout: "noBorders",
            },
          ],
          width: 260,
        },
      ],
      margin: [0, 0, 0, 16],
    },

    // ── NOTES & TERMS ─────────────────────────────────────────
    notes ? {
      stack: [
        { text: "NOTES", fontSize: 7, bold: true, color, letterSpacing: 1, margin: [0, 0, 0, 3] },
        { text: notes, fontSize: 9, color: "#4a5568", lineHeight: 1.5 },
      ],
      margin: [0, 0, 0, 10],
    } : {},

    terms ? {
      stack: [
        { text: "TERMS", fontSize: 7, bold: true, color, letterSpacing: 1, margin: [0, 0, 0, 3] },
        { text: terms, fontSize: 9, color: "#4a5568", lineHeight: 1.5 },
      ],
      margin: [0, 0, 0, 14],
    } : {},

    // ── AUTHORIZATION BLOCK ───────────────────────────────────
    {
      columns: [
        {
          stack: [
            { canvas: [{ type: "line", x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1, lineColor: "#cbd5e0" }] },
            { text: "Client Approval", fontSize: 8, color: "#718096", margin: [0, 4, 0, 0] },
            { text: "Signature · Date", fontSize: 7, color: "#a0aec0" },
          ],
        },
        { text: "", width: 40 },
        {
          stack: [
            { canvas: [{ type: "line", x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1, lineColor: "#cbd5e0" }] },
            { text: "Contractor Authorization", fontSize: 8, color: "#718096", margin: [0, 4, 0, 0] },
            { text: "Signature · Date", fontSize: 7, color: "#a0aec0" },
          ],
        },
      ],
      margin: [0, 0, 0, 16],
    },

    // ── WATERMARK FOOTER ──────────────────────────────────────
    watermark ? {
      text: "Generated by BuildChangeOrder.co — Free Change Order Generator",
      fontSize: 7, color: "#a0aec0", alignment: "center", margin: [0, 8, 0, 0],
    } : {
      text: "buildchangeorder.co",
      fontSize: 7, color: "#e2e8f0", alignment: "center", margin: [0, 8, 0, 0],
    },
  ].filter(Boolean);

  return {
    pageSize:    opts.pageSize  || "LETTER",
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#1a202c" },
    info: {
      title:   `Change Order ${change_order?.number || "CO-001"}`,
      author:  from?.name || "BuildChangeOrder",
      subject: "Change Order",
      creator: "buildchangeorder.co",
    },
    content,
  };
};
