/**
 * ==========================================================================
 * pdfexport.js - Standalone Fixed-Grid PDF Generator for NCR Traders
 * ==========================================================================
 * 
 * Generates an isolated, non-responsive, exact A4 layout (794px width)
 * with fixed table widths. Solves all alignment, offset, and colon
 * shifting issues completely across mobile, tablet, and desktop devices.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.InvoicePDFExporter = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }

  function formatIndianCurrency(num) {
    const val = Number(num) || 0;
    const parts = val.toFixed(2).split('.');
    let integerPart = parts[0];
    const decimalPart = parts[1];

    let lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    if (otherNumbers !== '') {
      lastThree = ',' + lastThree;
    }
    const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
    return `${formattedInteger}.${decimalPart}`;
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds() || '00').padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  }

  function numberToWordsIndian(num) {
    num = Math.round(Number(num) || 0);
    if (num === 0) return "Zero";
    if (num < 0) return "Minus " + numberToWordsIndian(Math.abs(num));

    const single = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    function convertTwoDigits(n) {
      if (n < 10) return single[n];
      if (n >= 10 && n < 20) return teens[n - 10];
      const unit = n % 10;
      return tens[Math.floor(n / 10)] + (unit !== 0 ? " " + single[unit] : "");
    }

    function convertThreeDigits(n) {
      let result = "";
      const hundred = Math.floor(n / 100);
      const rem = n % 100;
      if (hundred > 0) {
        result += single[hundred] + " Hundred";
        if (rem > 0) result += " and ";
      }
      if (rem > 0) {
        result += convertTwoDigits(rem);
      }
      return result;
    }

    let words = "";
    const crore = Math.floor(num / 10000000);
    let rem = num % 10000000;
    if (crore > 0) words += convertTwoDigits(crore) + " Crore ";

    const lakh = Math.floor(rem / 100000);
    rem = rem % 100000;
    if (lakh > 0) words += convertTwoDigits(lakh) + " Lakh ";

    const thousand = Math.floor(rem / 1000);
    rem = rem % 1000;
    if (thousand > 0) words += convertTwoDigits(thousand) + " Thousand ";

    if (rem > 0) words += convertThreeDigits(rem);
    return words.trim();
  }

  /**
   * Builds pixel-perfect A4 table layout at 794px width (A4 @ 96 DPI)
   * Guaranteed alignment: all headers, columns, metadata and totals are fixed-width tables.
   */
  function buildA4Html(state) {
    let subtotal = 0;
    const itemRows = (state.items || []).map((item, index) => {
      const lineTotal = Number(item.qty || 0) * Number(item.rate || 0);
      subtotal += lineTotal;

      let weighbridgeNote = '';
      if (item.useWeighbridge && (item.emptyWeight > 0 || item.loadWeight > 0)) {
        weighbridgeNote = `
          <div style="font-size: 9px; color: #475569; margin-top: 2px;">
            Empty Weight: ${Number(item.emptyWeight).toFixed(2)} | Gross Weight: ${Number(item.loadWeight).toFixed(2)} | Net Weight: ${Number(item.qty).toFixed(2)}
          </div>
        `;
      }

      return `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px dotted #cbd5e1; text-align: center; vertical-align: top; font-size: 11px;">
            ${index + 1}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px dotted #cbd5e1; text-align: left; vertical-align: top;">
            <div style="font-weight: 700; color: #0f172a; font-size: 11.5px;">
              ${escapeHtml(item.description)} ${item.hsn ? `<span style="font-size: 9.5px; font-weight: 500; color: #475569;">(HSN/SAC: ${escapeHtml(item.hsn)})</span>` : ''}
            </div>
            ${weighbridgeNote}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px dotted #cbd5e1; text-align: right; vertical-align: top; font-family: 'Courier New', monospace; font-size: 11.5px;">
            ${Number(item.rate || 0).toFixed(2)}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px dotted #cbd5e1; text-align: right; vertical-align: top; font-family: 'Courier New', monospace; font-weight: 700; font-size: 11.5px;">
            ${item.qty}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px dotted #cbd5e1; text-align: center; vertical-align: top; font-size: 11px;">
            ${escapeHtml(item.unit || 'Nos')}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px dotted #cbd5e1; text-align: right; vertical-align: top; font-family: 'Courier New', monospace; font-weight: 700; font-size: 11.5px;">
            ${lineTotal.toFixed(2)}
          </td>
        </tr>
      `;
    }).join('');

    // Tax calculation
    const rate = Number(state.gstRate) || 0;
    let totalTax = 0;
    let taxBreakdownHtml = '';

    if (state.taxType === 'intra' && rate > 0) {
      const halfRate = rate / 2;
      const halfTax = +(subtotal * (halfRate / 100)).toFixed(2);
      totalTax = +(halfTax * 2).toFixed(2);
      taxBreakdownHtml = `
        <span>SGST ${halfRate}% : <b style="font-family: 'Courier New', monospace;">₹ ${halfTax.toFixed(2)}</b> &nbsp;&nbsp;&nbsp;&nbsp; CGST ${halfRate}% : <b style="font-family: 'Courier New', monospace;">₹ ${halfTax.toFixed(2)}</b></span>
      `;
    } else if (state.taxType === 'inter' && rate > 0) {
      totalTax = +(subtotal * (rate / 100)).toFixed(2);
      taxBreakdownHtml = `
        <span>IGST ${rate}% : <b style="font-family: 'Courier New', monospace;">₹ ${totalTax.toFixed(2)}</b></span>
      `;
    } else {
      totalTax = 0;
      taxBreakdownHtml = `<span style="color: #64748b; font-style: italic;">Nil / Exempted</span>`;
    }

    // Grand Total & Round off
    const rawTotal = subtotal + totalTax;
    let finalGrandTotal = rawTotal;
    let roundOffAmount = 0;

    if (state.autoRoundOff !== false) {
      finalGrandTotal = Math.round(rawTotal);
      roundOffAmount = +(finalGrandTotal - rawTotal).toFixed(2);
    }

    const roundOffSign = roundOffAmount >= 0 ? (roundOffAmount > 0 ? `+${roundOffAmount.toFixed(2)}` : '0.00') : roundOffAmount.toFixed(2);
    const amountInWords = `${numberToWordsIndian(finalGrandTotal)} Rupees Only`;

    return `
      <div style="width: 794px; min-width: 794px; max-width: 794px; background: #ffffff; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.4; padding: 26px 32px; box-sizing: border-box;">
        
        <!-- HEADER -->
        <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #0f172a;">
            ${escapeHtml(state.sellerName || 'NCR TRADERS')}
          </h1>
          <p style="margin: 3px 0 0 0; font-size: 10.5px; color: #334155;">
            ${escapeHtml(state.sellerAddress || '')}
          </p>
          
          <table style="width: 100%; margin-top: 6px; font-size: 11px; font-weight: 600;">
            <tr>
              <td style="text-align: center; color: #1e293b;">
                Phone : <span style="font-family: 'Courier New', monospace; font-weight: 700;">${escapeHtml(state.sellerPhone || '-')}</span>
                &nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;&nbsp;
                GSTIN : <span style="font-family: 'Courier New', monospace; font-weight: 700; text-transform: uppercase;">${escapeHtml(state.sellerGstin || '-')}</span>
              </td>
            </tr>
          </table>

          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #94a3b8; text-align: center;">
            <span style="display: inline-block; font-size: 13.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; text-decoration: underline;">
              ${escapeHtml(state.docTitle || 'TAX INVOICE')}
            </span>
          </div>
        </div>

        <!-- TWO-COLUMN METADATA SECTION WITH LOCKED COLON (:) ALIGNMENT -->
        <div style="border-bottom: 1.5px solid #0f172a; padding: 10px 0;">
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <tr>
              <!-- LEFT COLUMN: CUSTOMER DETAILS -->
              <td style="width: 50%; vertical-align: top; padding-right: 15px; border-right: 1px dashed #cbd5e1;">
                <div style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 4px; letter-spacing: 0.05em;">
                  Customer / Bill To Details :
                </div>

                <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                  <tr>
                    <td style="width: 78px; color: #475569; padding: 2.5px 0; font-weight: 500;">Name</td>
                    <td style="width: 14px; text-align: center; font-weight: 700; color: #0f172a; padding: 2.5px 0;">:</td>
                    <td style="font-weight: 700; text-transform: uppercase; color: #0f172a; padding: 2.5px 0; font-size: 11.5px;">
                      ${escapeHtml(state.billTo || '-')}
                    </td>
                  </tr>

                  ${state.buyerPhone ? `
                  <tr>
                    <td style="width: 78px; color: #475569; padding: 2.5px 0; font-weight: 500;">Contact</td>
                    <td style="width: 14px; text-align: center; font-weight: 700; color: #0f172a; padding: 2.5px 0;">:</td>
                    <td style="font-family: 'Courier New', monospace; font-weight: 600; padding: 2.5px 0;">
                      ${escapeHtml(state.buyerPhone)}
                    </td>
                  </tr>
                  ` : ''}

                  ${state.buyerAddress ? `
                  <tr>
                    <td style="width: 78px; color: #475569; padding: 2.5px 0; vertical-align: top; font-weight: 500;">Address</td>
                    <td style="width: 14px; text-align: center; font-weight: 700; color: #0f172a; padding: 2.5px 0; vertical-align: top;">:</td>
                    <td style="color: #334155; padding: 2.5px 0; font-size: 10.5px; line-height: 1.35;">
                      ${escapeHtml(state.buyerAddress)}
                    </td>
                  </tr>
                  ` : ''}

                  ${state.buyerGstin ? `
                  <tr>
                    <td style="width: 78px; color: #475569; padding: 2.5px 0; font-weight: 500;">GSTIN</td>
                    <td style="width: 14px; text-align: center; font-weight: 700; color: #0f172a; padding: 2.5px 0;">:</td>
                    <td style="font-family: 'Courier New', monospace; font-weight: 500; color: #0f172a; padding: 2.5px 0;">
                      ${escapeHtml(state.buyerGstin)}
                    </td>
                  </tr>
                  ` : ''}
                </table>
              </td>

              <!-- RIGHT COLUMN: BILL & TRANSPORT DETAILS -->
              <td style="width: 50%; vertical-align: top; padding-left: 15px;">
                <div style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 4px; letter-spacing: 0.05em;">
                  Bill & Transport Details :
                </div>

                <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                  <tr>
                    <td style="width: 82px; color: #475569; padding: 2.5px 0; font-weight: 500;">Bill No</td>
                    <td style="width: 14px; text-align: center; font-weight: 700; color: #0f172a; padding: 2.5px 0;">:</td>
                    <td style="font-family: 'Courier New', monospace; font-weight: 800; color: #0f172a; padding: 2.5px 0;">
                      ${escapeHtml(state.billNo || '-')}
                    </td>
                  </tr>

                  <tr>
                    <td style="width: 82px; color: #475569; padding: 2.5px 0; font-weight: 500;">Bill Date</td>
                    <td style="width: 14px; text-align: center; font-weight: 700; color: #0f172a; padding: 2.5px 0;">:</td>
                    <td style="font-weight: 600; padding: 2.5px 0;">
                      ${formatDateTime(state.billDateTime)}
                    </td>
                  </tr>

                  <tr>
                    <td style="width: 82px; color: #475569; padding: 2.5px 0; font-weight: 500;">Bill Type</td>
                    <td style="width: 14px; text-align: center; font-weight: 700; color: #0f172a; padding: 2.5px 0;">:</td>
                    <td style="font-weight: 600; padding: 2.5px 0;">
                      ${escapeHtml(state.billType || 'Cash')}
                    </td>
                  </tr>

                  <tr>
                    <td style="width: 82px; color: #475569; padding: 2.5px 0; font-weight: 500;">Vehicle No</td>
                    <td style="width: 14px; text-align: center; font-weight: 700; color: #0f172a; padding: 2.5px 0;">:</td>
                    <td style="font-family: 'Courier New', monospace; font-weight: 700; text-transform: uppercase; padding: 2.5px 0;">
                      ${escapeHtml(state.vehicleNumber || '-')}
                    </td>
                  </tr>

                  <tr>
                    <td style="width: 82px; color: #475569; padding: 2.5px 0; font-weight: 500;">Delivery To</td>
                    <td style="width: 14px; text-align: center; font-weight: 700; color: #0f172a; padding: 2.5px 0;">:</td>
                    <td style="font-weight: 600; text-transform: uppercase; padding: 2.5px 0;">
                      ${escapeHtml(state.deliveryTo || '-')}
                    </td>
                  </tr>

                  <tr>
                    <td style="width: 82px; color: #475569; padding: 2.5px 0; font-weight: 500;">Driver Contact</td>
                    <td style="width: 14px; text-align: center; font-weight: 700; color: #0f172a; padding: 2.5px 0;">:</td>
                    <td style="font-family: 'Courier New', monospace; padding: 2.5px 0;">
                      ${escapeHtml(state.driverPhone || '-')}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>

        <!-- ITEMS TABLE -->
        <div style="padding-top: 8px;">
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <thead>
              <tr style="border-bottom: 1.5px solid #0f172a; font-weight: 800; background: #f8fafc; font-size: 11px;">
                <th style="padding: 6px 8px; text-align: center; width: 6%;">#</th>
                <th style="padding: 6px 8px; text-align: left; width: 44%;">Description of Goods / Services</th>
                <th style="padding: 6px 8px; text-align: right; width: 14%;">Rate (₹)</th>
                <th style="padding: 6px 8px; text-align: right; width: 12%;">Qty</th>
                <th style="padding: 6px 8px; text-align: center; width: 8%;">Unit</th>
                <th style="padding: 6px 8px; text-align: right; width: 16%;">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>
        </div>

        <!-- TAX & ROUND OFF SUMMARY -->
        <div style="border-top: 1.5px solid #0f172a; padding-top: 6px; font-size: 11px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 2.5px 0; font-weight: 700;">Subtotal (Taxable Value)</td>
              <td style="padding: 2.5px 0; text-align: right; font-family: 'Courier New', monospace; font-weight: 700;">
                ₹ ${formatIndianCurrency(subtotal)}
              </td>
            </tr>
            <tr>
              <td style="padding: 2.5px 0; font-size: 10px; color: #334155;">
                ${taxBreakdownHtml}
              </td>
              <td style="padding: 2.5px 0; text-align: right; font-family: 'Courier New', monospace; font-weight: 700;">
                ₹ ${totalTax.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td style="padding: 2.5px 0; font-size: 10px; color: #475569;">Round off Adjustment</td>
              <td style="padding: 2.5px 0; text-align: right; font-family: 'Courier New', monospace;">
                ${roundOffSign}
              </td>
            </tr>
          </table>
        </div>

        <!-- GRAND TOTAL BAR -->
        <div style="border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; margin: 8px 0; padding: 6px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="font-size: 14.5px; font-weight: 800; text-transform: uppercase;">Grand Total</td>
              <td style="text-align: right; font-size: 18px; font-weight: 800; font-family: 'Courier New', monospace;">
                ₹ ${formatIndianCurrency(finalGrandTotal)}
              </td>
            </tr>
          </table>
        </div>

        <!-- AMOUNT IN WORDS -->
        <div style="border-bottom: 1.5px solid #0f172a; padding-bottom: 8px;">
          <span style="color: #64748b; font-size: 9.5px; text-transform: uppercase; font-weight: 700;">Amount Chargeable (in words) :</span>
          <div style="font-weight: 700; font-style: italic; text-transform: capitalize; color: #0f172a; margin-top: 2px;">
            ${escapeHtml(amountInWords)}
          </div>
        </div>

        <!-- DECLARATION & SIGNATURE -->
        <div style="padding-top: 10px;">
          <div style="font-size: 9.5px; color: #475569; line-height: 1.4;">
            ${escapeHtml(state.declaration || 'We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.')}
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 30px;">
            <tr>
              <td style="width: 50%; vertical-align: bottom;">
                <div style="width: 130px; border-top: 1px dashed #64748b; margin-bottom: 3px;"></div>
                <span style="font-size: 9.5px; color: #64748b;">Customer's Signature</span>
              </td>
              <td style="width: 50%; text-align: right; vertical-align: bottom;">
                <div style="font-size: 9.5px; color: #475569;">Authorized Signatory</div>
                <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 3px;">
                  For ${escapeHtml(state.sellerName || 'NCR TRADERS')}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- FOOTER -->
        <div style="margin-top: 14px; padding-top: 6px; border-top: 1px dashed #cbd5e1; text-align: center; font-size: 8.5px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">
          This is a computer generated invoice
        </div>

      </div>
    `;
  }

  function exportPDF(state, triggerButton) {
    if (!window.html2pdf) {
      alert("PDF library is still loading. Please try again.");
      return;
    }

    const originalBtnHtml = triggerButton ? triggerButton.innerHTML : '';
    if (triggerButton) {
      triggerButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating PDF...`;
      triggerButton.disabled = true;
    }

    // Isolated off-screen render container
    // CRITICAL FIX: Do NOT use left: -9999px. html2canvas uses element coordinates relative to window/screen,
    // which causes massive clipping, blank space, and horizontal/vertical offsets.
    // Instead, place it at top: 0, left: 0, and clip it or set opacity/visibility so the layout engine
    // and html2canvas see normal (0, 0) coordinates.
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.width = '794px';
    wrapper.style.overflow = 'hidden';
    wrapper.style.zIndex = '-99999';
    wrapper.style.opacity = '0';
    wrapper.style.pointerEvents = 'none';

    wrapper.innerHTML = buildA4Html(state);
    document.body.appendChild(wrapper);

    const targetElement = wrapper.firstElementChild;

    const billNoClean = (state.billNo || 'Invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${billNoClean}_tax_invoice.pdf`;

    const opt = {
      margin: 0, // Margin is already handled by internal CSS padding (26px 32px)
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        width: 794,
        windowWidth: 794,
        letterRendering: true,
        logging: false
      },
      jsPDF: { unit: 'px', format: [794, 1123], orientation: 'portrait', hotfixes: ['px_scaling'] }
    };

    window.html2pdf().set(opt).from(targetElement).save().then(() => {
      if (wrapper.parentNode) {
        document.body.removeChild(wrapper);
      }
      if (triggerButton) {
        triggerButton.innerHTML = originalBtnHtml;
        triggerButton.disabled = false;
      }
    }).catch((err) => {
      console.error("PDF generation failure:", err);
      if (wrapper.parentNode) {
        document.body.removeChild(wrapper);
      }
      alert("Could not generate PDF directly. Please use Print and choose 'Save as PDF'.");
      if (triggerButton) {
        triggerButton.innerHTML = originalBtnHtml;
        triggerButton.disabled = false;
      }
    });
  }

  return {
    exportPDF: exportPDF,
    buildA4Html: buildA4Html
  };
}));
