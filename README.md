# NCR Traders - GST Tax Invoice & Delivery Note System

A fast, responsive, mobile-first Progressive Web App (PWA) designed for **NCR Traders** (Blue Metal, M-Sand, Aggregates, Cement, and Quarry Transport) generating standardized A4 Tax Invoices and Weighbridge Delivery Notes.

---

## 🏢 Business Profile

- **Entity**: NCR Traders
- **Address**: 2/92-2, Kurangani, Thoothukudi, Tamil Nadu, 628623
- **GSTIN**: 33ENIPR3307E1Z6
- **Phone**: +91 9489522652

---

## 🚀 Key Features

1. **Standard A4 Layout (Screen, Print & PDF)**:
   - Formatted strictly for standard **A4 paper** with zero thermal slip compromises.
   - Fixed-width table grids ensure that column labels, colons (`:`), and values stay aligned across mobile, tablet, and desktop viewports.

2. **Built-in Weighbridge Tare / Gross Calculator**:
   - Inputs for **Empty (Tare) Weight** and **Gross (Load) Weight** in Tons.
   - Auto-computes **Net Weight** ($Gross - Empty$) and populates billing quantity.
   - Automatically prints a weighment log note (`Empty: X.XX | Gross: Y.YY | Net: Z.ZZ`) on the invoice.

3. **Quick Presets**:
   - One-touch insertion of standard materials and HSN codes:
     - 20mm, 40mm, 12mm Blue Metal Aggregates
     - 6mm Blue Metal Chips
     - Black M-Sand & Plastering P-Sand
     - Quarry Dust & GSB / WMM Base
     - Cement Bags (50kg) & Transport Trips

4. **Tax & Round-Off Automation**:
   - Supports **Intra-State** (SGST + CGST split), **Inter-State** (IGST), or **Exempted / Nil** tax rates.
   - Automated Indian Currency round-off calculation.
   - Converts final Grand Total into Indian currency words (*"Rupees ... Only"*).

5. **Sequential Auto-Numbering**:
   - Automatic bill numbering in the format: `YYMM` + 2-digit incremental counter (e.g., `261001`, `261002`).
   - Persists the latest bill count in `localStorage`.

6. **Direct Pixel-Mapped PDF Export (`pdfexport.js`)**:
   - Standalone PDF generation module using fixed 794px coordinate mapping (`html2pdf.js` + `html2canvas`).
   - Zero viewport drift or off-screen clipping; outputs a sharp A4 portrait PDF with 1-click.

7. **Isolated Print System**:
   - Dedicated print area that isolates the invoice element away from navigation bars, side forms, and control panels during printing (`Ctrl + P`).

8. **PWA & Offline Capability**:
   - Fully installable on Android, iOS, Windows, and Mac as a standalone app.
   - Includes Service Worker (`sw.js`) with cache fallback for offline job-site invoicing.
   - In-browser local invoice history with 1-click invoice recall.

---

## 📁 Project Structure

```
blue-metal-invoice/
│
├── index.html        # Main application markup & UI layout
├── style.css         # Styling, print CSS (@media print), and A4 paper constraints
├── app.js            # Main controller, state management, calculation & PWA logic
├── pdfexport.js      # Isolated fixed-grid A4 PDF export engine
├── sw.js             # Service Worker for offline caching and PWA support
├── manifest.json     # PWA installation manifest & theme colors
├── icons/            # App icons (192x192, 512x512)
└── README.md         # Documentation & deployment guide
```

---

## 💻 How to Run & Deploy

### Option 1: Direct File Open
Double-click `index.html` or open it directly in Google Chrome, Microsoft Edge, Safari, or Firefox.

### Option 2: Local Static Server
Using Node.js:
```powershell
npx serve .
```
Or using Python:
```powershell
python -m http.server 8080
```

### Option 3: Production Static Deployment
Deploy directly to any static web host:
- **GitHub Pages**: Push repo and enable GitHub Pages in Settings > Pages.
- **Vercel / Netlify / Cloudflare Pages / Firebase Hosting**: Drag-and-drop the directory or link the repository with zero build configuration needed.
