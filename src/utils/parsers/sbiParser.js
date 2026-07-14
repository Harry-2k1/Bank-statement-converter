const DATE_PAIR_RE = /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+)$/;

const SKIP_PATTERNS = [
  /^account name\s*:/i,
  /^account number\s*:/i,
  /^account description\s*:/i,
  /^branch\s*:/i,
  /^drawing power\s*:/i,
  /^interest rate/i,
  /^mod balance/i,
  /^cif no/i,
  /^ifs code/i,
  /^micr code/i,
  /^balance as on/i,
  /^account statement from/i,
  /^the number of transactions/i,
  /^address\s+/i,
  /^txn date/i,
  /^value date/i,
  /^description/i,
  /^ref no/i,
  /^branch\s*code/i,
  /^debit\s+credit/i,
  /^balance$/i,
  /^salem$/i,
  /^tamilnadu-/i,
  /^india$/i,
  /^\*\*this is a computer generated/i,
  /^---page---$/i,
];

const STOP_PATTERNS = [
  /^\*\*this is a computer generated statement/i,
];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmount(token) {
  return Number(String(token).replace(/,/g, ''));
}

function extractFooter(text) {
  const chequeFooter = text.match(
    /\/\s*(\d{5,6})\s+(\d{4,5})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/,
  );
  if (chequeFooter) {
    return {
      refNo: chequeFooter[1],
      branchCode: chequeFooter[2],
      debit: parseAmount(chequeFooter[3]),
      credit: null,
      balance: parseAmount(chequeFooter[4]),
      particularsEnd: chequeFooter.index,
    };
  }

  const branchFooter = text.match(
    /(\d{4,5})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/,
  );
  if (!branchFooter) return null;

  const branchCode = branchFooter[1];
  const amt1 = parseAmount(branchFooter[2]);
  const balance = parseAmount(branchFooter[3]);
  const before = text.slice(0, branchFooter.index).trim();
  const upper = before.toUpperCase();

  const creditHints =
    /BY TRANSFER|CREDIT-|CSH DEP|NEFT RET|REFUND|ITDTAX REFUND|BULK POSTING.*REFUND/i;
  const debitHints = /TO TRANSFER|TO DEBIT|DEBIT-|CASH CHEQUE|CASH WITHDRAWAL/i;

  if (creditHints.test(upper) && !debitHints.test(upper)) {
    return {
      refNo: '',
      branchCode,
      debit: null,
      credit: amt1,
      balance,
      particularsEnd: branchFooter.index,
    };
  }

  return {
    refNo: '',
    branchCode,
    debit: amt1,
    credit: null,
    balance,
    particularsEnd: branchFooter.index,
  };
}

/**
 * Parse State Bank of India account statement text into transaction rows.
 */
export function parseSbiStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let pending = null;

  const flush = () => {
    if (!pending) return;
    const joined = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
    const footer = extractFooter(joined);
    if (!footer) {
      pending = null;
      return;
    }

    const particulars = joined
      .slice(0, footer.particularsEnd)
      .replace(/\s+/g, ' ')
      .trim();

    rows.push({
      txnDate: pending.txnDate,
      valueDate: pending.valueDate,
      description: particulars,
      refNo: footer.refNo,
      branchCode: footer.branchCode,
      debit: footer.debit,
      credit: footer.credit,
      balance: footer.balance,
    });
    pending = null;
  };

  for (const raw of lines) {
    if (STOP_PATTERNS.some((re) => re.test(raw))) {
      flush();
      break;
    }
    if (shouldSkip(raw)) continue;

    const dateMatch = raw.match(DATE_PAIR_RE);
    if (dateMatch) {
      flush();
      pending = {
        txnDate: dateMatch[1],
        valueDate: dateMatch[2],
        lines: [dateMatch[3]],
      };
      const joined = dateMatch[3];
      if (extractFooter(joined)) {
        flush();
      }
      continue;
    }

    if (!pending) continue;
    pending.lines.push(raw);
    const joined = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
    if (extractFooter(joined)) {
      flush();
    }
  }

  flush();
  return rows;
}

export const SBI_COLUMNS = [
  { key: 'txnDate', header: 'Txn Date' },
  { key: 'valueDate', header: 'Value Date' },
  { key: 'description', header: 'Description' },
  { key: 'refNo', header: 'Ref No./Cheque No.' },
  { key: 'branchCode', header: 'Branch Code' },
  { key: 'debit', header: 'Debit' },
  { key: 'credit', header: 'Credit' },
  { key: 'balance', header: 'Balance' },
];
