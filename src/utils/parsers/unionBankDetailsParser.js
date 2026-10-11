const TXN_START_RE = /(\d{2}-\d{2}-\d{4})\s+([A-Za-z0-9]{6,12})/gi;
const AMOUNT_SIDE_RE = /([\d,]+\.\d{2})\s*\(\s*(Cr|Dr)\s*\)/gi;
const TXN_END_RE =
  /([\d,]+\.\d{2})\s*\(\s*(Cr|Dr)\s*\)\s+([\d,]+\.\d{2})(?:\s*\(\s*(Cr|Dr)\s*\))?/gi;
const TXN_END_BARE_RE =
  /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*\(\s*(Cr|Dr)\s*\)\s*\(\s*(Cr|Dr)\s*\)/gi;
const DATE_RE = /(\d{2}-\d{2}-\d{4})/g;
const TXN_ID_RE =
  /(?:^|\s)([A-Z][A-Z0-9]{5,9}|\d{8,10})(?=\s+(?:NEFT|IMPS|MOBFT|RTGS|RTGSO|NEFTO|CHRGE|chrge|COM:|GST:|SELF|TR TO|Reg |MOBFT))/g;

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
    .replace(/Details of Statement[\s\S]*?(?=Date\s+Transaction|\d{2}-\d{2}-)/gi, '\n')
    .replace(/Your Details[\s\S]*?(?=Date\s+Transaction|\d{2}-\d{2}-)/gi, '\n')
    .replace(/Account Details[\s\S]*?(?=Date\s+Transaction|\d{2}-\d{2}-)/gi, '\n')
    .replace(/Statement Details[\s\S]*?(?=Date\s+Transaction|\d{2}-\d{2}-)/gi, '\n')
    .replace(/Date\s+Transaction\s+Id\s+Remarks\s+Amount[^\n]*\s+Balance[^\n]*/gi, '\n')
    .replace(/Transaction\s+Id/gi, '\n')
    .replace(/Amount\s*\([^)]*\)/gi, '\n')
    .replace(/Balance\s*\([^)]*\)/gi, '\n')
    .replace(/Page\s+\d+\s+of\s+\d+/gi, '\n')
    .replace(/This is a system generated[\s\S]*$/gi, '\n')
    .replace(/Union Bank of India, established[\s\S]*$/gi, '\n')
    .replace(/Registered office:[\s\S]*$/gi, '\n')
    .replace(/Customers are requested[\s\S]*?(?=\d{2}-\d{2}-|\n20\d{2}\s)/gi, '\n')
    .replace(/Find out more[\s\S]*?(?=\d{2}-\d{2}-|\n20\d{2}\s)/gi, '\n');
}

function normalizeOcr(text) {
  return text
    .replace(/[€§`~“”]/g, '')
    .replace(/\(Cn\)|\(cn\)|\(On\)|\(on\)/gi, '(Cr)')
    .replace(/\(01\)/g, '(Dr)')
    .replace(/,(\d{2})\(/g, '.$1(')
    .replace(/(\d),(\d{3}\.\d{2})/g, '$1$2')
    .replace(/(\d{2}):(\d{2})/g, '$1-$2')
    .replace(/(\d{2}-\d{2}-)\s*\n\s*(20\d{2})/g, '$1$2')
    .replace(/\n(20\d{2})\s+([A-Za-z0-9]{6,12})\s+/g, '\n$1-$2 ')
    .replace(/(\d{2}-\d{2}-)\s+([A-Za-z0-9]{6,12})\s+/g, '$12026 $2 ')
    .replace(/(\d{2}-\d{2}-2026)\s+2026\s+/g, '$1 ')
    .replace(/(\d{2}-\d{2}-2026)\s+1\s+([A-Za-z0-9]{6,12})/g, '$1 $2')
    .replace(/([\d,]+\.\d{2})\s*\n\s*\(\s*(Cr|Dr)\s*\)/gi, '$1($2)')
    .replace(
      /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*\n\s*(20\d{2})[^\n]*\(\s*(Cr|Dr)\s*\)\s*\(\s*(Cr|Dr)\s*\)/gi,
      '$1($4) $2($5)',
    );
}

function preprocess(text) {
  return normalizeOcr(stripNoise(text))
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ');
}

function parseMovementSide(side) {
  return String(side || '').toUpperCase() === 'DR' ? 'DR' : 'CR';
}

function buildRow(date, txnId, remarks, movement, movementSide, balanceValue, balanceSide) {
  const side = parseMovementSide(movementSide);
  return {
    date,
    txnId,
    remarks: remarks.replace(/\s+/g, ' ').trim(),
    withdrawal: side === 'DR' ? movement : null,
    deposit: side === 'CR' ? movement : null,
    balance: formatBalance(balanceValue, balanceSide),
  };
}

function extractContext(before) {
  const dates = [...before.matchAll(DATE_RE)];
  const ids = [...before.matchAll(TXN_ID_RE)];
  const date = dates.at(-1)?.[1] || '';
  const idMatch = ids.at(-1);
  const txnId = idMatch?.[1] || '';
  const remarksStart = idMatch ? idMatch.index + idMatch[0].length : 0;
  const remarks = before.slice(remarksStart).replace(/^\s*[|\-:=]+\s*/, '').trim();
  return { date, txnId, remarks };
}

function parseByAmountAnchors(text) {
  const rows = [];
  const seen = new Set();

  for (const match of text.matchAll(TXN_END_RE)) {
    const movement = parseAmount(match[1]);
    const movementSide = match[2];
    const balanceValue = match[3];
    const balanceSide = match[4] || movementSide;
    if (!Number.isFinite(movement)) continue;

    const before = text.slice(Math.max(0, match.index - 260), match.index);
    const { date, txnId, remarks } = extractContext(before);
    const key = `${date}|${txnId}|${movement}|${balanceValue}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push(
      buildRow(date, txnId, remarks, movement, movementSide, balanceValue, balanceSide),
    );
  }

  for (const match of text.matchAll(TXN_END_BARE_RE)) {
    const movement = parseAmount(match[1]);
    const balanceValue = match[2];
    const movementSide = match[3];
    const balanceSide = match[4];
    if (!Number.isFinite(movement)) continue;

    const before = text.slice(Math.max(0, match.index - 260), match.index);
    const { date, txnId, remarks } = extractContext(before);
    const key = `${date}|${txnId}|${movement}|${balanceValue}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push(
      buildRow(date, txnId, remarks, movement, movementSide, balanceValue, balanceSide),
    );
  }

  return rows;
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
  const movementSide = movementMatch[2];
  const balanceValue = balanceMatch[1];
  const balanceSide = balanceMatch[2];

  if (!Number.isFinite(movement)) return null;

  return buildRow('', '', remarks, movement, movementSide, balanceValue, balanceSide);
}

function parseByTxnStarts(text) {
  const starts = [...text.matchAll(TXN_START_RE)];
  const rows = [];

  for (let i = 0; i < starts.length; i += 1) {
    const date = starts[i][1];
    const txnId = starts[i][2];
    const bodyStart = starts[i].index + starts[i][0].length;
    const bodyEnd = i + 1 < starts.length ? starts[i + 1].index : text.length;
    const parsed = parseBody(text.slice(bodyStart, bodyEnd));
    if (!parsed) continue;
    rows.push({ ...parsed, date, txnId });
  }

  return rows;
}

/**
 * Parse Union Bank "Details of Statement" PDFs
 * (Date / Transaction Id / Remarks / Amount Cr-Dr / Balance).
 */
export function parseUnionBankDetailsStatement(text) {
  const prepared = preprocess(text);
  const anchored = parseByAmountAnchors(prepared);
  if (anchored.length) return anchored;

  return parseByTxnStarts(prepared);
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
    /Current Account/i.test(text) &&
    /\d{2}-\d{2}-?\s*\d{0,4}\s+[A-Za-z0-9]{6,}/i.test(text) &&
    /\(\s*(Cr|Dr)\s*\)/i.test(text)
  );
}
