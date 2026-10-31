/**
 * ==========================================================================
 * app.js - Application Controller for NCR Traders
 * ==========================================================================
 */

const STORAGE_KEY = 'NCR_TRADERS_INVOICE_HISTORY';
const LAST_BILL_COUNTER_KEY = 'NCR_TRADERS_LAST_COUNTER';

// Generate YYMM+Incremental number (e.g. 261001, 261002...)
function generateNextBillNo() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const currentPrefix = `${yy}${mm}`;

  let lastData = { prefix: currentPrefix, counter: 0 };
  try {
    const raw = localStorage.getItem(LAST_BILL_COUNTER_KEY);
    if (raw) {
      lastData = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not read last bill counter:", e);
  }

  let nextCounter = 1;
  if (lastData.prefix === currentPrefix) {
    nextCounter = (parseInt(lastData.counter, 10) || 0) + 1;
  } else {
    nextCounter = 1;
  }

  const counterStr = nextCounter < 10 ? `0${nextCounter}` : `${nextCounter}`;
  return `${currentPrefix}${counterStr}`;
}

function markBillCounterUsed(billNo) {
  if (!billNo || billNo.length < 5) return;
  const prefix = billNo.slice(0, 4);
  const counterPart = parseInt(billNo.slice(4), 10);
  if (!isNaN(counterPart)) {
    try {
      localStorage.setItem(LAST_BILL_COUNTER_KEY, JSON.stringify({
        prefix: prefix,
        counter: counterPart
      }));
    } catch (e) { }
  }
}

// Default state with NCR Traders
const DEFAULT_STATE = {
  sellerName: "NCR Traders",
  sellerAddress: "2/92-2, Kurangani, Thoothukudi, Tamil Nadu, 628623",
  sellerPhone: "9489522652",
  sellerGstin: "33ENIPR3307E1Z6",
  docTitle: "Tax Invoice",
  billNo: "",
  billDateTime: "",
  billType: "Cash",
  billTo: "",
  buyerPhone: "",
  buyerAddress: "",
  deliveryTo: "",
  vehicleNumber: "",
  driverPhone: "",
  buyerGstin: "",
  taxType: "intra",
  gstRate: 5,
  autoRoundOff: true,
  isA4Mode: true,
  declaration: "We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.",
  items: [
    {
      id: "item_1",
      description: "20MM BLUE METAL AGGREGATE",
      hsn: "251710",
      useWeighbridge: true,
      emptyWeight: 3.50,
      loadWeight: 14.50,
      qty: 11.00,
      rate: 620.00,
      unit: "Ton"
    }
  ]
};

let appState = JSON.parse(JSON.stringify(DEFAULT_STATE));
let zoomScale = 1.0;

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('NCR Traders PWA ServiceWorker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('PWA registration failed:', err);
      });
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initBillNumber();
  setupInitialDateTime();
  setupTraderToggle();
  setupMobileTabs();
  bindFormEvents();
  bindPresetEvents();
  renderItemsForm();
  updateCalculationsAndSlip();
  updateHistoryCount();
  setupZoomAndMode();
});

function initBillNumber() {
  const initialBillNo = generateNextBillNo();
  appState.billNo = initialBillNo;
  const billNoInput = document.getElementById('billNo');
  if (billNoInput) {
    billNoInput.value = initialBillNo;
  }
}

function setupTraderToggle() {
  const toggleBtn = document.getElementById('toggleTrader');
  const fields = document.getElementById('traderFields');
  if (toggleBtn && fields) {
    toggleBtn.addEventListener('click', () => {
      fields.classList.toggle('hidden');
    });
  }
}

function setupMobileTabs() {
  const btnEdit = document.getElementById('btnTabEdit');
  const btnPreview = document.getElementById('btnTabPreview');
  const formSection = document.getElementById('formSection');
  const previewSection = document.getElementById('previewSection');
  const btnMobilePreviewToggle = document.getElementById('btnMobilePreviewToggle');

  function showEdit() {
    formSection.classList.remove('hidden');
    previewSection.classList.add('hidden');
    if (btnEdit && btnPreview) {
      btnEdit.className = 'flex-1 py-1.5 text-xs font-semibold rounded-md bg-amber-500 text-slate-950 transition flex items-center justify-center gap-1.5';
      btnPreview.className = 'flex-1 py-1.5 text-xs font-semibold rounded-md text-slate-300 hover:text-white transition flex items-center justify-center gap-1.5';
    }
    if (btnMobilePreviewToggle) {
      btnMobilePreviewToggle.innerHTML = `<i class="fa-solid fa-eye"></i> View Slip`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showPreview() {
    formSection.classList.add('hidden');
    previewSection.classList.remove('hidden');
    if (btnEdit && btnPreview) {
      btnPreview.className = 'flex-1 py-1.5 text-xs font-semibold rounded-md bg-amber-500 text-slate-950 transition flex items-center justify-center gap-1.5';
      btnEdit.className = 'flex-1 py-1.5 text-xs font-semibold rounded-md text-slate-300 hover:text-white transition flex items-center justify-center gap-1.5';
    }
    if (btnMobilePreviewToggle) {
      btnMobilePreviewToggle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Details`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (btnEdit) btnEdit.addEventListener('click', showEdit);
  if (btnPreview) btnPreview.addEventListener('click', showPreview);

  if (btnMobilePreviewToggle) {
    btnMobilePreviewToggle.addEventListener('click', () => {
      if (previewSection.classList.contains('hidden')) {
        showPreview();
      } else {
        showEdit();
      }
    });
  }

  // Mobile print & PDF triggers
  const btnMobilePrint = document.getElementById('btnMobilePrint');
  if (btnMobilePrint) {
    btnMobilePrint.addEventListener('click', triggerPrint);
  }

  const btnMobilePDF = document.getElementById('btnMobilePDF');
  if (btnMobilePDF) {
    btnMobilePDF.addEventListener('click', () => exportToPDF(btnMobilePDF));
  }
}

function setupInitialDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const currentLocalISO = `${year}-${month}-${day}T${hours}:${minutes}`;
  const dtInput = document.getElementById('billDateTime');
  if (dtInput) {
    dtInput.value = currentLocalISO;
  }
  appState.billDateTime = currentLocalISO;
}

function formatDisplayDateTime(isoStr) {
  if (!isoStr) return "";
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

function bindFormEvents() {
  const textInputs = [
    { id: 'sellerName', key: 'sellerName' },
    { id: 'sellerAddress', key: 'sellerAddress' },
    { id: 'sellerPhone', key: 'sellerPhone' },
    { id: 'sellerGstin', key: 'sellerGstin' },
    { id: 'docTitle', key: 'docTitle' },
    { id: 'billNo', key: 'billNo' },
    { id: 'billDateTime', key: 'billDateTime' },
    { id: 'billType', key: 'billType' },
    { id: 'billTo', key: 'billTo' },
    { id: 'buyerPhone', key: 'buyerPhone' },
    { id: 'buyerAddress', key: 'buyerAddress' },
    { id: 'deliveryTo', key: 'deliveryTo' },
    { id: 'vehicleNumber', key: 'vehicleNumber' },
    { id: 'driverPhone', key: 'driverPhone' },
    { id: 'buyerGstin', key: 'buyerGstin' },
    { id: 'declarationText', key: 'declaration' },
    { id: 'taxType', key: 'taxType' },
    { id: 'gstRate', key: 'gstRate', isNumber: true },
    { id: 'autoRoundOff', key: 'autoRoundOff', isCheckbox: true }
  ];

  textInputs.forEach(item => {
    const el = document.getElementById(item.id);
    if (!el) return;

    const handler = () => {
      if (item.isCheckbox) {
        appState[item.key] = el.checked;
      } else if (item.isNumber) {
        appState[item.key] = parseFloat(el.value) || 0;
      } else {
        appState[item.key] = el.value;
      }
      updateCalculationsAndSlip();
    };

    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });

  document.getElementById('btnAddItem').addEventListener('click', () => {
    addNewItemRow();
  });

  document.getElementById('btnNewInvoice').addEventListener('click', () => {
    if (confirm("Create a new bill? Incremental number will be incremented.")) {
      resetToNewInvoice();
    }
  });

  document.getElementById('btnPrintInvoice').addEventListener('click', triggerPrint);

  const btnExport = document.getElementById('btnExportPDF');
  btnExport.addEventListener('click', () => exportToPDF(btnExport));

  document.getElementById('btnHistory').addEventListener('click', openHistoryModal);
  document.getElementById('btnCloseHistory').addEventListener('click', closeHistoryModal);
  document.getElementById('btnCloseHistory2').addEventListener('click', closeHistoryModal);
  document.getElementById('btnClearHistory').addEventListener('click', clearAllHistory);
}

function bindPresetEvents() {
  const quickPreset = document.getElementById('quickPreset');
  if (!quickPreset) return;
  quickPreset.addEventListener('change', () => {
    const val = quickPreset.value;
    if (!val) return;
    const parts = val.split('|');
    if (parts.length >= 4) {
      const isTonUnit = parts[3] === 'Ton';
      addNewItemRow({
        description: parts[0],
        hsn: parts[1],
        rate: parseFloat(parts[2]),
        unit: parts[3],
        useWeighbridge: isTonUnit,
        emptyWeight: isTonUnit ? 3.50 : 0,
        loadWeight: isTonUnit ? 14.50 : 0,
        qty: isTonUnit ? 11.00 : 1
      });
    }
    quickPreset.value = "";
  });
}

function addNewItemRow(presetData = null) {
  const newId = 'item_' + Date.now();
  const newItem = presetData || {
    id: newId,
    description: "20MM BLUE METAL AGGREGATE",
    hsn: "251710",
    useWeighbridge: true,
    emptyWeight: 3.50,
    loadWeight: 14.50,
    qty: 11.00,
    rate: 620.00,
    unit: "Ton"
  };
  newItem.id = newId;
  appState.items.push(newItem);
  renderItemsForm();
  updateCalculationsAndSlip();
}

function renderItemsForm() {
  const container = document.getElementById('itemsContainer');
  container.innerHTML = '';

  appState.items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'item-card space-y-3 relative';

    card.innerHTML = `
      <div class="flex justify-between items-center pb-2 border-b border-slate-100">
        <span class="text-xs font-bold text-slate-700 flex items-center gap-2">
          <span class="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-bold">
            ${index + 1}
          </span>
          Item #${index + 1}
        </span>
        <div class="flex items-center gap-3">
          <label class="text-[11px] text-slate-600 flex items-center gap-1 cursor-pointer">
            <input type="checkbox" class="item-weighbridge-check rounded text-amber-600" data-id="${item.id}" ${item.useWeighbridge ? 'checked' : ''}>
            <span>Tare/Gross Calc</span>
          </label>
          ${appState.items.length > 1 ? `
            <button type="button" class="btn-remove-item text-red-500 hover:text-red-700 text-xs px-2 py-0.5 rounded hover:bg-red-50" data-id="${item.id}" title="Remove Item">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : ''}
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
        <div class="sm:col-span-8">
          <label class="block text-slate-600 font-medium mb-1">Description / Material / Service</label>
          <input type="text" class="item-desc w-full px-2.5 py-1.5 border rounded focus:ring-1 focus:ring-amber-500 uppercase font-semibold text-xs sm:text-sm" value="${escapeHtml(item.description)}" data-id="${item.id}">
        </div>
        <div class="sm:col-span-4">
          <label class="block text-slate-600 font-medium mb-1">HSN / SAC Code</label>
          <input type="text" class="item-hsn w-full px-2.5 py-1.5 border rounded focus:ring-1 focus:ring-amber-500 font-mono text-xs sm:text-sm" value="${escapeHtml(item.hsn || '')}" placeholder="e.g. 251710" data-id="${item.id}">
        </div>
      </div>

      <!-- Weighbridge Tare/Gross -->
      <div class="weighbridge-section ${item.useWeighbridge ? '' : 'hidden'} bg-amber-50/70 p-2.5 rounded border border-amber-200/70 grid grid-cols-3 gap-2 text-xs" data-weigh-id="${item.id}">
        <div>
          <label class="block text-amber-900 font-medium text-[11px] mb-0.5">Empty Wt (Ton)</label>
          <input type="number" step="0.01" class="item-empty-wt w-full px-2 py-1 border rounded bg-white font-mono text-xs" value="${item.emptyWeight || 0}" data-id="${item.id}">
        </div>
        <div>
          <label class="block text-amber-900 font-medium text-[11px] mb-0.5">Gross Wt (Ton)</label>
          <input type="number" step="0.01" class="item-gross-wt w-full px-2 py-1 border rounded bg-white font-mono text-xs" value="${item.loadWeight || 0}" data-id="${item.id}">
        </div>
        <div>
          <label class="block text-amber-900 font-semibold text-[11px] mb-0.5">Net Wt (Qty)</label>
          <input type="number" step="0.01" class="item-calc-net w-full px-2 py-1 border rounded bg-amber-100 font-mono font-bold text-xs" value="${item.qty || 0}" readonly data-id="${item.id}">
        </div>
      </div>

      <!-- Rate, Qty, Unit, Line Total -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div>
          <label class="block text-slate-600 font-medium mb-1">Rate (₹)</label>
          <input type="number" step="any" class="item-rate w-full px-2.5 py-1.5 border rounded focus:ring-1 focus:ring-amber-500 font-mono text-xs sm:text-sm" value="${item.rate}" data-id="${item.id}">
        </div>
        <div>
          <label class="block text-slate-600 font-medium mb-1">Quantity</label>
          <input type="number" step="any" class="item-qty w-full px-2.5 py-1.5 border rounded focus:ring-1 focus:ring-amber-500 font-mono text-xs sm:text-sm" value="${item.qty}" ${item.useWeighbridge ? 'readonly bg-slate-50' : ''} data-id="${item.id}">
        </div>
        <div>
          <label class="block text-slate-600 font-medium mb-1">Unit</label>
          <select class="item-unit w-full px-2.5 py-1.5 border rounded focus:ring-1 focus:ring-amber-500 text-xs sm:text-sm" data-id="${item.id}">
            <option value="Ton" ${item.unit === 'Ton' ? 'selected' : ''}>Ton</option>
            <option value="Bags" ${item.unit === 'Bags' ? 'selected' : ''}>Bags</option>
            <option value="Trip" ${item.unit === 'Trip' ? 'selected' : ''}>Trip</option>
            <option value="Load" ${item.unit === 'Load' ? 'selected' : ''}>Load</option>
            <option value="Shift" ${item.unit === 'Shift' ? 'selected' : ''}>Shift</option>
            <option value="Nos" ${item.unit === 'Nos' ? 'selected' : ''}>Nos</option>
            <option value="Set" ${item.unit === 'Set' ? 'selected' : ''}>Set</option>
            <option value="Days" ${item.unit === 'Days' ? 'selected' : ''}>Days</option>
            <option value="Sq.Ft" ${item.unit === 'Sq.Ft' ? 'selected' : ''}>Sq.Ft</option>
            <option value="Kgs" ${item.unit === 'Kgs' ? 'selected' : ''}>Kgs</option>
          </select>
        </div>
        <div>
          <label class="block text-slate-600 font-medium mb-1">Line Total (₹)</label>
          <input type="text" class="item-total w-full px-2.5 py-1.5 border rounded bg-slate-100 font-mono font-bold text-xs sm:text-sm text-slate-900" value="${(item.qty * item.rate).toFixed(2)}" readonly>
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  bindItemRowEvents();
}

function bindItemRowEvents() {
  document.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      appState.items = appState.items.filter(i => i.id !== id);
      renderItemsForm();
      updateCalculationsAndSlip();
    });
  });

  document.querySelectorAll('.item-weighbridge-check').forEach(chk => {
    chk.addEventListener('change', () => {
      const id = chk.getAttribute('data-id');
      const item = appState.items.find(i => i.id === id);
      if (item) {
        item.useWeighbridge = chk.checked;
        const card = chk.closest('.item-card');
        const weighSection = card.querySelector(`[data-weigh-id="${id}"]`);
        const qtyInput = card.querySelector('.item-qty');

        if (chk.checked) {
          weighSection.classList.remove('hidden');
          qtyInput.setAttribute('readonly', 'true');
          qtyInput.classList.add('bg-slate-50');
          const net = Math.max(0, +(item.loadWeight - item.emptyWeight).toFixed(2));
          item.qty = net;
          card.querySelector('.item-calc-net').value = net;
          qtyInput.value = net;
        } else {
          weighSection.classList.add('hidden');
          qtyInput.removeAttribute('readonly');
          qtyInput.classList.remove('bg-slate-50');
        }
        updateCalculationsAndSlip();
      }
    });
  });

  document.querySelectorAll('.item-desc').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = appState.items.find(i => i.id === id);
      if (item) {
        item.description = e.target.value;
        updateCalculationsAndSlip();
      }
    });
  });

  document.querySelectorAll('.item-hsn').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = appState.items.find(i => i.id === id);
      if (item) {
        item.hsn = e.target.value;
        updateCalculationsAndSlip();
      }
    });
  });

  document.querySelectorAll('.item-empty-wt').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = appState.items.find(i => i.id === id);
      if (item) {
        item.emptyWeight = parseFloat(e.target.value) || 0;
        const card = e.target.closest('.item-card');
        const net = Math.max(0, +(item.loadWeight - item.emptyWeight).toFixed(2));
        item.qty = net;
        card.querySelector('.item-calc-net').value = net;
        card.querySelector('.item-qty').value = net;
        const lineTot = +(item.qty * item.rate).toFixed(2);
        card.querySelector('.item-total').value = lineTot.toFixed(2);
        updateCalculationsAndSlip();
      }
    });
  });

  document.querySelectorAll('.item-gross-wt').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = appState.items.find(i => i.id === id);
      if (item) {
        item.loadWeight = parseFloat(e.target.value) || 0;
        const card = e.target.closest('.item-card');
        const net = Math.max(0, +(item.loadWeight - item.emptyWeight).toFixed(2));
        item.qty = net;
        card.querySelector('.item-calc-net').value = net;
        card.querySelector('.item-qty').value = net;
        const lineTot = +(item.qty * item.rate).toFixed(2);
        card.querySelector('.item-total').value = lineTot.toFixed(2);
        updateCalculationsAndSlip();
      }
    });
  });

  document.querySelectorAll('.item-rate').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = appState.items.find(i => i.id === id);
      if (item) {
        item.rate = parseFloat(e.target.value) || 0;
        const card = e.target.closest('.item-card');
        const lineTot = +(item.qty * item.rate).toFixed(2);
        card.querySelector('.item-total').value = lineTot.toFixed(2);
        updateCalculationsAndSlip();
      }
    });
  });

  document.querySelectorAll('.item-qty').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = appState.items.find(i => i.id === id);
      if (item) {
        item.qty = parseFloat(e.target.value) || 0;
        const card = e.target.closest('.item-card');
        const lineTot = +(item.qty * item.rate).toFixed(2);
        card.querySelector('.item-total').value = lineTot.toFixed(2);
        updateCalculationsAndSlip();
      }
    });
  });

  document.querySelectorAll('.item-unit').forEach(select => {
    select.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = appState.items.find(i => i.id === id);
      if (item) {
        item.unit = e.target.value;
        updateCalculationsAndSlip();
      }
    });
  });
}

function updateCalculationsAndSlip() {
  let subtotal = 0;
  const tableRowsHtml = [];

  appState.items.forEach((item, index) => {
    const lineTotal = +(item.qty * item.rate).toFixed(2);
    subtotal += lineTotal;

    let weighbridgeNote = '';
    if (item.useWeighbridge && (item.emptyWeight > 0 || item.loadWeight > 0)) {
      weighbridgeNote = `<div class="text-[9.5px] text-slate-500 font-mono mt-0.5">Empty: ${item.emptyWeight.toFixed(2)} | Gross: ${item.loadWeight.toFixed(2)} | Net: ${item.qty.toFixed(2)}</div>`;
    }

    tableRowsHtml.push(`
      <tr>
        <td class="text-center py-1.5 px-1 font-mono">${index + 1}</td>
        <td class="text-left py-1.5 px-2">
          <div class="font-bold text-slate-900">${escapeHtml(item.description)} ${item.hsn ? `<span class="text-[9.5px] font-normal text-slate-500">(HSN: ${escapeHtml(item.hsn)})</span>` : ''}</div>
          ${weighbridgeNote}
        </td>
        <td class="text-right py-1.5 px-2 font-mono">${item.rate.toFixed(2)}</td>
        <td class="text-right py-1.5 px-2 font-mono font-bold">${item.qty}</td>
        <td class="text-center py-1.5 px-1">${escapeHtml(item.unit)}</td>
        <td class="text-right py-1.5 px-2 font-mono font-bold">${lineTotal.toFixed(2)}</td>
      </tr>
    `);
  });

  let totalTax = 0;
  let taxBreakdownHtml = '';
  const rate = appState.gstRate;

  if (appState.taxType === 'intra' && rate > 0) {
    const halfRate = rate / 2;
    const halfTax = +(subtotal * (halfRate / 100)).toFixed(2);
    totalTax = +(halfTax * 2).toFixed(2);
    taxBreakdownHtml = `<span>SGST ${halfRate}% : <b class="font-mono">${halfTax.toFixed(2)}</b> &nbsp;&nbsp;&nbsp; CGST ${halfRate}% : <b class="font-mono">${halfTax.toFixed(2)}</b></span>`;
  } else if (appState.taxType === 'inter' && rate > 0) {
    totalTax = +(subtotal * (rate / 100)).toFixed(2);
    taxBreakdownHtml = `<span>IGST ${rate}% : <b class="font-mono">${totalTax.toFixed(2)}</b></span>`;
  } else {
    totalTax = 0;
    taxBreakdownHtml = `<span class="italic text-slate-400">Nil / Exempted</span>`;
  }

  const rawTotal = subtotal + totalTax;
  let finalGrandTotal = rawTotal;
  let roundOffAmount = 0;

  if (appState.autoRoundOff) {
    finalGrandTotal = Math.round(rawTotal);
    roundOffAmount = +(finalGrandTotal - rawTotal).toFixed(2);
  }

  // Update DOM Preview
  document.getElementById('slipSellerName').textContent = appState.sellerName;
  document.getElementById('slipSellerAddress').textContent = appState.sellerAddress;
  document.getElementById('slipSellerPhone').textContent = appState.sellerPhone || "-";
  document.getElementById('slipSellerGstin').textContent = appState.sellerGstin || "-";
  document.getElementById('slipDocTitle').textContent = appState.docTitle;

  // Customer
  document.getElementById('slipBillTo').textContent = appState.billTo || "-";

  const buyerPhoneEl = document.getElementById('slipBuyerPhone');
  const buyerPhoneRow = document.getElementById('slipBuyerPhoneRow');
  if (appState.buyerPhone) {
    buyerPhoneEl.textContent = appState.buyerPhone;
    if (buyerPhoneRow) buyerPhoneRow.style.display = 'table-row';
  } else if (buyerPhoneRow) {
    buyerPhoneRow.style.display = 'none';
  }

  const buyerAddressEl = document.getElementById('slipBuyerAddress');
  const buyerAddressRow = document.getElementById('slipBuyerAddressRow');
  if (appState.buyerAddress) {
    buyerAddressEl.textContent = appState.buyerAddress;
    if (buyerAddressRow) buyerAddressRow.style.display = 'table-row';
  } else if (buyerAddressRow) {
    buyerAddressRow.style.display = 'none';
  }

  const buyerGstinEl = document.getElementById('slipBuyerGstin');
  const buyerGstinRow = document.getElementById('slipBuyerGstinRow');
  if (appState.buyerGstin) {
    buyerGstinEl.textContent = appState.buyerGstin;
    if (buyerGstinRow) buyerGstinRow.style.display = 'table-row';
  } else if (buyerGstinRow) {
    buyerGstinRow.style.display = 'none';
  }

  // Bill & Dispatch
  document.getElementById('slipBillNo').textContent = appState.billNo;
  document.getElementById('slipBillDate').textContent = formatDisplayDateTime(appState.billDateTime);
  document.getElementById('slipBillType').textContent = appState.billType;
  document.getElementById('slipVehicleNumber').textContent = appState.vehicleNumber || "-";
  document.getElementById('slipDeliveryTo').textContent = appState.deliveryTo || "-";
  document.getElementById('slipDriverPhone').textContent = appState.driverPhone || "-";

  // Items
  document.getElementById('slipItemsTableBody').innerHTML = tableRowsHtml.join('');

  // Tax and Grand Total
  document.getElementById('slipSubtotalAmount').textContent = formatIndianNumber(subtotal);
  document.getElementById('slipTaxAmount').textContent = totalTax.toFixed(2);
  document.getElementById('slipTaxBreakdown').innerHTML = taxBreakdownHtml;

  const roundOffSign = roundOffAmount >= 0 ? (roundOffAmount > 0 ? `+${roundOffAmount.toFixed(2)}` : '0.00') : roundOffAmount.toFixed(2);
  document.getElementById('slipRoundOff').textContent = roundOffSign;
  document.getElementById('slipGrandTotal').textContent = formatIndianNumber(finalGrandTotal);

  // Amount in words
  const words = numberToWordsIndian(Math.round(finalGrandTotal));
  document.getElementById('slipAmountInWords').textContent = `${words} Rupees Only`;

  // Declaration & Signatory
  document.getElementById('slipDeclaration').textContent = appState.declaration;
  document.getElementById('slipSignatoryCompany').textContent = appState.sellerName;
}

function formatIndianNumber(num) {
  const parts = Number(num).toFixed(2).split('.');
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

function numberToWordsIndian(num) {
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

// Print Handler: clones invoice directly into isolated print area
function triggerPrint() {
  saveToHistory(false);
  updateCalculationsAndSlip();

  const printArea = document.getElementById('printIsolatedArea');
  const slipElement = document.getElementById('printableSlip');

  if (printArea && slipElement) {
    printArea.innerHTML = '';
    const clone = slipElement.cloneNode(true);
    printArea.appendChild(clone);

    setTimeout(() => {
      window.print();
    }, 60);
  } else {
    window.print();
  }
}

// PDF Exporter Delegate
function exportToPDF(triggerBtn) {
  saveToHistory(false);
  updateCalculationsAndSlip();

  const btn = triggerBtn || document.getElementById('btnExportPDF');
  if (window.InvoicePDFExporter) {
    window.InvoicePDFExporter.exportPDF(appState, btn);
  } else {
    alert("PDF generator module is initializing. Please try again.");
  }
}

function setupZoomAndMode() {
  const container = document.getElementById('previewContainer');
  const zoomIn = document.getElementById('zoomIn');
  const zoomOut = document.getElementById('zoomOut');
  const zoomLevel = document.getElementById('zoomLevel');

  if (zoomIn && zoomOut && container && zoomLevel) {
    zoomIn.addEventListener('click', () => {
      if (zoomScale < 1.4) {
        zoomScale += 0.1;
        applyZoom();
      }
    });

    zoomOut.addEventListener('click', () => {
      if (zoomScale > 0.6) {
        zoomScale -= 0.1;
        applyZoom();
      }
    });

    function applyZoom() {
      container.style.transform = `scale(${zoomScale.toFixed(1)})`;
      zoomLevel.textContent = `${Math.round(zoomScale * 100)}%`;
    }
  }
}

function resetToNewInvoice() {
  markBillCounterUsed(appState.billNo);

  const nextBillNo = generateNextBillNo();
  setupInitialDateTime();
  appState.billNo = nextBillNo;
  document.getElementById('billNo').value = nextBillNo;

  appState.billTo = "";
  document.getElementById('billTo').value = "";

  appState.buyerPhone = "";
  document.getElementById('buyerPhone').value = "";

  appState.buyerAddress = "";
  document.getElementById('buyerAddress').value = "";

  appState.buyerGstin = "";
  document.getElementById('buyerGstin').value = "";

  appState.vehicleNumber = "";
  document.getElementById('vehicleNumber').value = "";

  appState.deliveryTo = "";
  document.getElementById('deliveryTo').value = "";

  appState.driverPhone = "";
  document.getElementById('driverPhone').value = "";

  appState.items = [
    {
      id: "item_" + Date.now(),
      description: "20MM BLUE METAL AGGREGATE",
      hsn: "251710",
      useWeighbridge: true,
      emptyWeight: 0,
      loadWeight: 0,
      qty: 0,
      rate: 620.00,
      unit: "Ton"
    }
  ];

  renderItemsForm();
  updateCalculationsAndSlip();
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveToHistory(isAlert = true) {
  markBillCounterUsed(appState.billNo);

  const history = getHistory();
  const entry = {
    id: 'inv_' + Date.now(),
    savedAt: new Date().toISOString(),
    state: JSON.parse(JSON.stringify(appState))
  };

  history.unshift(entry);
  if (history.length > 40) history.pop();

  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  updateHistoryCount();
  if (isAlert) alert("Invoice saved to history!");
}

function updateHistoryCount() {
  const history = getHistory();
  const el = document.getElementById('historyCount');
  if (el) el.textContent = history.length;
}

function openHistoryModal() {
  const history = getHistory();
  const list = document.getElementById('historyList');
  list.innerHTML = '';

  if (history.length === 0) {
    list.innerHTML = `<p class="text-sm text-slate-500 py-6 text-center">No saved invoices yet. Generated bills will appear here.</p>`;
  } else {
    history.forEach((item) => {
      const state = item.state;
      const dateStr = formatDisplayDateTime(state.billDateTime);
      const totalAmt = calculateStateTotal(state);

      const div = document.createElement('div');
      div.className = 'p-3 border rounded-lg hover:border-amber-400 bg-white flex justify-between items-center text-xs';
      div.innerHTML = `
        <div>
          <div class="font-bold text-slate-900">${escapeHtml(state.billNo)} - ${escapeHtml(state.billTo || 'Cash Customer')}</div>
          <div class="text-slate-500 mt-0.5">${state.buyerPhone ? 'Ph: ' + escapeHtml(state.buyerPhone) + ' | ' : ''}Vehicle: <span class="font-mono">${escapeHtml(state.vehicleNumber || 'N/A')}</span> | ${dateStr}</div>
        </div>
        <div class="flex items-center gap-2 sm:gap-3">
          <span class="font-bold font-mono text-sm text-slate-900">₹ ${totalAmt}</span>
          <button class="btn-load-history px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded font-semibold text-xs" data-id="${item.id}">
            Load
          </button>
        </div>
      `;
      list.appendChild(div);
    });

    document.querySelectorAll('.btn-load-history').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = history.find(h => h.id === id);
        if (item) {
          appState = JSON.parse(JSON.stringify(item.state));
          syncStateToForm();
          renderItemsForm();
          updateCalculationsAndSlip();
          closeHistoryModal();
        }
      });
    });
  }

  document.getElementById('historyModal').classList.remove('hidden');
}

function calculateStateTotal(state) {
  let subtotal = 0;
  (state.items || []).forEach(i => subtotal += (Number(i.qty || 0) * Number(i.rate || 0)));
  let tax = 0;
  if (state.taxType !== 'exempt') {
    tax = subtotal * (Number(state.gstRate || 0) / 100);
  }
  return formatIndianNumber(Math.round(subtotal + tax));
}

function syncStateToForm() {
  document.getElementById('sellerName').value = appState.sellerName;
  document.getElementById('sellerAddress').value = appState.sellerAddress;
  document.getElementById('sellerPhone').value = appState.sellerPhone || '';
  document.getElementById('sellerGstin').value = appState.sellerGstin;
  document.getElementById('docTitle').value = appState.docTitle;
  document.getElementById('billNo').value = appState.billNo;
  document.getElementById('billDateTime').value = appState.billDateTime;
  document.getElementById('billType').value = appState.billType;
  document.getElementById('billTo').value = appState.billTo;
  document.getElementById('buyerPhone').value = appState.buyerPhone || '';
  document.getElementById('buyerAddress').value = appState.buyerAddress || '';
  document.getElementById('deliveryTo').value = appState.deliveryTo;
  document.getElementById('vehicleNumber').value = appState.vehicleNumber;
  document.getElementById('driverPhone').value = appState.driverPhone;
  document.getElementById('buyerGstin').value = appState.buyerGstin || '';
  document.getElementById('taxType').value = appState.taxType;
  document.getElementById('gstRate').value = appState.gstRate;
  document.getElementById('autoRoundOff').checked = appState.autoRoundOff;
  document.getElementById('declarationText').value = appState.declaration;
}

function closeHistoryModal() {
  document.getElementById('historyModal').classList.add('hidden');
}

function clearAllHistory() {
  if (confirm("Are you sure you want to clear all saved invoice history?")) {
    localStorage.removeItem(STORAGE_KEY);
    updateHistoryCount();
    openHistoryModal();
  }
}
