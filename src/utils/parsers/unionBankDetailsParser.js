const TXN_START_RE = /(\d{2}-\d{2}-\d{4})\s+([A-Z]{1,3}\d{5,10})(?=\s|$)/gi;
const AMOUNT_SIDE_RE = /([\d,]+\.\d{2})\s*\(\s*(Cr|Dr)\s*\)/gi;

const SKIP_LINE_PATTERNS = [
  /^details of statement$/i,
  /^current account$/i,
  /^your details$/i,
  /^account details$/i,
  /^statement details$/i,
  /^name$/i,
  /^address$/i,
  /^mobile no$/i,
  /^email id$/i,
  /^customer\/?cif id$/i,
  /^account type$/i,
  /^account name$/i,
  /^account number$/i,
  /^currency$/i,
  /^ifsc$/i,
  /^branch address$/i,
  /^statement date$/i,
  /^statement period$/i,
  /^date$/i,
  /^transaction$/i,
  /^id$/i,
  /^remarks$/i,
  /^amount/i,
  /^balance/i,
  /^union bank of india$/i,
  /^union\s*ease$/i,
  /^page\s+\d+\s+of\s+\d+/i,
  /^this is a system generated/i,
  /^customers are requested/i,
  /^registered office/i,
  /^find out more/i,
  /^https?:\/\//i,
  /^we shall continue/i,
  /^our relationships are lifelong/i,
  /^good people to bank with/i,
];

function shouldSkipLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return SKIP_LINE_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmount(token) {
  return Number(String(token).replace(/,/g, ''));
}

function formatBalance(value, side) {
  return `${value} ${side.toUpperCase()}`;
}

function stripNoise(text) {
  return text
    .replace(/Details of Statement[\s\S]*?(?=Date\s+Transaction|\d{2}-\d{2}-)/i, '\n')
    .replace(/Your Details[\s\S]*?(?=Date\s+Transaction|\d{2}-\d{2}-)/i, '\n')
    .replace(/Account Details[\s\S]*?(?=Date\s+Transaction|\d{2}-\d{2}-)/i, '\n')
    .replace(/Statement Details[\s\S]*?(?=Date\s+Transaction|\d{2}-\d{2}-)/i, '\n')
    .replace(/Date\s+Transaction\s+Id\s+Remarks\s+Amount[^\n]*\s+Balance[^\n]*/gi, '\n')
    .replace(/Transaction\s+Id/gi, '\n')
    .replace(/Amount\s*\([^)]*\)/gi, '\n')
    .replace(/Balance\s*\([^)]*\)/gi, '\n')
    .replace(/Page\s+\d+\s+of\s+\d+/gi, '\n')
    .replace(/This is a system generated[\s\S]*$/gi, '\n')
    .replace(/Union Bank of India, established[\s\S]*$/gi, '\n')
    .replace(/Registered office:[\s\S]*$/gi, '\n');
}

/**
 * Join wrapped date / Cr-Dr cells that pdf.js often splits across lines.
 */
function preprocess(text) {
  return stripNoise(text)
    .replace(/\r/g, '')
    .replace(/(\d{2}-\d{2}-)\s*\n\s*(20\d{2})/g, '$1$2')
    .replace(/([\d,]+\.\d{2})\s*\n\s*\(\s*(Cr|Dr)\s*\)/gi, '$1($2)')
    .replace(/[ \t]+/g, ' ');
}

function parseBody(body) {
  const cleaned = body
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => !shouldSkipLine(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;

  const amounts = [...cleaned.matchAll(AMOUNT_SIDE_RE)];
  if (amounts.length < 2) return null;

  const movementMatch = amounts[amounts.length - 2];
  const balanceMatch = amounts[amounts.length - 1];
  const remarks = cleaned.slice(0, movementMatch.index).replace(/\s+/g, ' ').trim();
  const movement = parseAmount(movementMatch[1]);
  const movementSide = movementMatch[2].toUpperCase();
  const balanceValue = balanceMatch[1];
  const balanceSide = balanceMatch[2].toUpperCase();

  if (!Number.isFinite(movement)) return null;

  return {
    remarks,
    withdrawal: movementSide === 'DR' ? movement : null,
    deposit: movementSide === 'CR' ? movement : null,
    balance: formatBalance(balanceValue, balanceSide),
  };
}

/**
 * Parse Union Bank "Details of Statement" PDFs
 * (Date / Transaction Id / Remarks / Amount Cr-Dr / Balance).
 */
export function parseUnionBankDetailsStatement(text) {
  const prepared = preprocess(text);
  const starts = [...prepared.matchAll(TXN_START_RE)];
  const rows = [];

  for (let i = 0; i < starts.length; i += 1) {
    const date = starts[i][1];
    const txnId = starts[i][2];
    const bodyStart = starts[i].index + starts[i][0].length;
    const bodyEnd = i + 1 < starts.length ? starts[i + 1].index : prepared.length;
    const parsed = parseBody(prepared.slice(bodyStart, bodyEnd));
    if (!parsed) continue;

    rows.push({
      date,
      txnId,
      remarks: parsed.remarks,
      withdrawal: parsed.withdrawal,
      deposit: parsed.deposit,
      balance: parsed.balance,
    });
  }

  return rows;
}

export const UNION_BANK_DETAILS_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'txnId', header: 'Transaction Id' },
  { key: 'remarks', header: 'Remarks' },
  { key: 'withdrawal', header: 'Withdrawals' },
  { key: 'deposit', header: 'Deposits' },
  { key: 'balance', header: 'Balance' },
];

export function isUnionBankDetailsFormat(text) {
  return (
    /Details of Statement/i.test(text) &&
    /Transaction\s*Id/i.test(text) &&
    /\d{2}-\d{2}-?\s*\d{0,4}\s+[A-Z]{1,3}\d{5,}/i.test(text) &&
    /\(\s*(Cr|Dr)\s*\)/i.test(text)
  );
}
