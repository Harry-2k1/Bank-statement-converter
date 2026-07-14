# Statement Converter

Vite + React + MUI app that converts **HDFC Bank**, **Indian Bank**, and **Karur Vysya Bank (KVB)** PDF account statements into Excel (`.xlsx`).

## Features

- Choose HDFC Bank, Indian Bank, or Karur Vysya Bank
- Modern drag-and-drop PDF upload
- Client-side PDF parsing and Excel download
- Sample statements in `sample statments/`

## Setup

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal (usually `http://localhost:5173`).

## Usage

1. Select a bank.
2. Upload the matching statement PDF.
3. Click **Convert to Excel** — the `.xlsx` file downloads automatically.

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Start development server |
| `npm run build`| Production build         |
| `npm run preview` | Preview production build |

## Notes

- Works best with text-based statement PDFs (not scanned images).
- Parsing is tuned for the layouts in `sample statments/hdfcBank.pdf` and `sample statments/indianBank.pdf`.
