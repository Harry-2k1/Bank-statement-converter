const TXN_START_RE = /^\d+\s+[SM]\d/i;
const VALUE_DATE_RE = /\d{2}\/[A-Za-z]{3}\/\d{4}/;
const SLASH_DATE_RE = /\d{2}\/\d{2}\/\d{4}/;
const AMOUNT_RE = /[\d,]+\.\d{2}/g;
const TIME_RE = /\d{2}:\d{2}:\d{2}\s*(?:AM|PM)?/gi;

const SKIP_PATTERNS = [
  /^detailed$/i,
  /^statement$/i,
  /^name:/i,
  /^address:/i,
  /^branch address:/i,
  /^a\/c no:/i,
  /^transaction date$/i,
  /^transaction period:/i,
  /^sl\s*no/i,
  /^tran\s*id/i,
  /^value\s*date/i,
  /^page \d+ of/i,
  /^advanced search/i,
  /^amount from:/i,
  /^cheque number from:/i,
  /^transaction remarks:/i,
  /^transaction type:/i,
  /^withdrawal \(dr\)/i,
  /^deposit\(cr\)/i,
  /^balance$/i,
  /^cheque no/i,
  /^transaction posted/i,
];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmount(token) {
  return Number(String(token).replace(/,/g, ''));
}

function normalizeLines(lines) {
  const result = [];

  for (const raw of lines) {
    let line = raw.replace(/([\d,]+)\s+\.(\d{2})\b/g, '$1.$2');

    if (/^\.\d{2}$/.test(line) && result.length) {
      result[result.length - 1] += line;
      continue;
    }

    if (/^\d{2}$/.test(line) && result.length) {
      const prev = result[result.length - 1];
      if (/[\d,]+\.$/.test(prev) || /\/(?:\d{2}|[A-Za-z]{3}\/\d{2})$/.test(prev)) {
        result[result.length - 1] += line;
        continue;
      }
    }

    if (
      /^\d{3,5}$/.test(line) &&
      result.length &&
      /^\d+\s+[SM]\d+$/i.test(result[result.length - 1])
    ) {
      result[result.length - 1] += line;
      continue;
    }

    if (/^[a-z]{2,}$/.test(line) && result.length && /[a-z]\.$/i.test(result[result.length - 1])) {
      result[result.length - 1] += line;
      continue;
    }

    result.push(line);
  }

  return result;
}

function splitBlocks(lines) {
  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (TXN_START_RE.test(line)) {
      if (current) blocks.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }

  if (current) blocks.push(current);
  return blocks;
}

function parseBlock(blockLines) {
  const tailText = blockLines.slice(-8).join(' ').replace(/\s+/g, ' ').trim();
  const negMarker = /(?:^|\s)-(?:\s|$)/.test(tailText);
  const amounts = tailText.match(AMOUNT_RE) || [];
  if (amounts.length < 2) return null;

  const movement = parseAmount(amounts[amounts.length - 2]);
  let balance = parseAmount(amounts[amounts.length - 1]);
  if (negMarker) balance = -Math.abs(balance);

  const joined = blockLines.join(' ').replace(/\s+/g, ' ').trim();
  const valueDates = joined.match(new RegExp(VALUE_DATE_RE.source, 'g')) || [];
  const slashDates = joined.match(new RegExp(SLASH_DATE_RE.source, 'g')) || [];

  const valueDate = valueDates[0] || '';
  const txnDate = slashDates[0] || '';
  const postedDate = slashDates[1] || '';

  const tranIdMatch = blockLines[0].match(/^\d+\s+([SM]\d[\d\s]*)/i);
  const tranId = tranIdMatch ? tranIdMatch[1].replace(/\s+/g, '') : '';

  const tailCut = tailText.lastIndexOf(amounts[amounts.length - 2]);
  const headText = joined.slice(0, joined.length - tailText.length + tailCut);

  const remarks = headText
    .replace(/^\d+\s+[SM]\d[\d\s]*/i, '')
    .replace(new RegExp(VALUE_DATE_RE.source, 'g'), ' ')
    .replace(new RegExp(SLASH_DATE_RE.source, 'g'), ' ')
    .replace(TIME_RE, ' ')
    .replace(/[\d,]+\.\d{2}/g, ' ')
    .replace(/\s-\s/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!remarks) return null;

  return {
    tranId,
    valueDate,
    txnDate,
    postedDate,
    remarks,
    movement,
    balance,
  };
}

function classifyMovement(remarks, movement, balance, prevBalance) {
  if (prevBalance !== null && Number.isFinite(prevBalance)) {
    const delta = Number((balance - prevBalance).toFixed(2));
    if (Math.abs(Math.abs(delta) - movement) < 0.05) {
      return delta >= 0
        ? { withdrawal: null, deposit: movement }
        : { withdrawal: movement, deposit: null };
    }
    if (Math.abs(delta) > 0.05) {
      const amt = Math.abs(delta);
      return delta >= 0
        ? { withdrawal: null, deposit: amt }
        : { withdrawal: amt, deposit: null };
    }
  }

  const upper = remarks.toUpperCase();
  if (/NEFT-RETURN|RETURN|REFUND|DISBURSEMENT|REV\b|CREDIT/i.test(upper)) {
    return { withdrawal: null, deposit: movement };
  }
  return { withdrawal: movement, deposit: null };
}

/**
 * Parse ICICI Bank detailed statement text into transaction rows.
 */
export function parseIciciStatement(text) {
  const rawLines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const lines = normalizeLines(rawLines.filter((l) => !shouldSkip(l)));
  const rows = [];
  let prevBalance = null;

  for (const block of splitBlocks(lines)) {
    const parsed = parseBlock(block);
    if (!parsed) continue;

    const { withdrawal, deposit } = classifyMovement(
      parsed.remarks,
      parsed.movement,
      parsed.balance,
      prevBalance,
    );

    rows.push({
      valueDate: parsed.valueDate,
      txnDate: parsed.txnDate,
      postedDate: parsed.postedDate,
      tranId: parsed.tranId,
      remarks: parsed.remarks,
      withdrawal,
      deposit,
      balance: parsed.balance,
    });

    prevBalance = parsed.balance;
  }

  return rows;
}

export const ICICI_COLUMNS = [
  { key: 'valueDate', header: 'Value Date' },
  { key: 'txnDate', header: 'Transaction Date' },
  { key: 'postedDate', header: 'Posted Date' },
  { key: 'tranId', header: 'Tran Id' },
  { key: 'remarks', header: 'Transaction Remarks' },
  { key: 'withdrawal', header: 'Withdrawal (Dr)' },
  { key: 'deposit', header: 'Deposit (Cr)' },
  { key: 'balance', header: 'Balance' },
];
