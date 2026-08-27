const TXN_LINE_RE =
  /^(\d{2}[–-]\d{2}[–-]\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+Cr\s*$/i;
const OPENING_BF_RE = /^(\d{2}[–-]\d{2}[–-]\d{4})\s+B\/F\s+([\d,]+\.\d{2})\s+Cr/i;

const SKIP_PATTERNS = [
  /^type of account/i,
  /^account number/i,
  /^balance \(inr/i,
  /^micr/i,
  /^ifsc/i,
  /^nomination/i,
  /^total\s+[\d,]/i,
  /^statement of transactions/i,
  /^date\s+particulars/i,
  /^chq\.no\./i,
  /^withdrawals/i,
  /^deposits/i,
  /^autosweep/i,
  /^reverse sweep/i,
  /^balance\(inr/i,
  /^page total/i,
  /^legends for transactions/i,
  /^sincerely,/i,
  /^team icici bank/i,
  /^this is a system-generated/i,
  /^summary of account/i,
  /^operative account/i,
  /^regd address/i,
  /^this is an authenticated/i,
  /^your details with us/i,
  /^your base branch/i,
  /^category of service/i,
  /^page \d+$/i,
  /^vat\/mat\/nfs/i,
  /^\[icrm_/i,
];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmount(token) {
  return Number(String(token).replace(/,/g, ''));
}

function normalizeDate(token) {
  return token.replace(/–/g, '-').replace(/-/g, '/');
}

function classifyMovement(particulars, withdrawal, deposit) {
  if (deposit > 0 && withdrawal <= 0) {
    return { withdrawal: null, deposit };
  }
  if (withdrawal > 0 && deposit <= 0) {
    return { withdrawal, deposit: null };
  }
  if (deposit >= withdrawal) {
    return { withdrawal: null, deposit: deposit || withdrawal };
  }
  return { withdrawal: withdrawal || deposit, deposit: null };
}

/**
 * Parse ICICI Bank summary statement PDFs (Date / Particulars / Withdrawals / Deposits layout).
 */
export function parseIciciNewStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let prevBalance = null;

  for (const raw of lines) {
    if (shouldSkip(raw)) continue;

    const opening = raw.match(OPENING_BF_RE);
    if (opening) {
      prevBalance = parseAmount(opening[2]);
      continue;
    }

    const match = raw.match(TXN_LINE_RE);
    if (!match) continue;

    const date = normalizeDate(match[1]);
    const particulars = match[2].replace(/\s+/g, ' ').trim();
    const withdrawal = parseAmount(match[3]);
    const deposit = parseAmount(match[4]);
    const balance = parseAmount(match[5]);

    const { withdrawal: wd, deposit: dp } = classifyMovement(particulars, withdrawal, deposit);

    rows.push({
      date,
      particulars,
      withdrawal: wd,
      deposit: dp,
      balance,
    });

    prevBalance = balance;
  }

  return rows;
}

export const ICICI_NEW_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'particulars', header: 'Particulars' },
  { key: 'withdrawal', header: 'Withdrawals' },
  { key: 'deposit', header: 'Deposits' },
  { key: 'balance', header: 'Balance (INR)' },
];

export function isIciciNewFormat(text) {
  return (
    /Statement of transactions in Account number:/i.test(text) &&
    /Balance\(INR\s*\)/i.test(text) &&
    /\d{2}[–-]\d{2}[–-]\d{4}\s+.+\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s+Cr/i.test(text)
  );
}
