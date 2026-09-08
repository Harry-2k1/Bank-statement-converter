const DATE_START_RE =
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})\b(.*)$/i;
const FOOTER_RE =
  /^(INR\s[\d,]+\.\d{2}|\-)\s+(INR\s[\d,]+\.\d{2}|\-)\s+INR\s([\d,]+\.\d{2})(?:\s+(CR|DR))?$/i;
const INLINE_FOOTER_RE =
  /(INR\s[\d,]+\.\d{2}|\-)\s+(INR\s[\d,]+\.\d{2}|\-)\s+INR\s([\d,]+\.\d{2})(?:\s+(CR|DR))?\s*$/i;
const CREDIT_ONLY_FOOTER_RE =
  /^-\s+INR\s([\d,]+\.\d{2})\s+INR\s([\d,]+\.\d{2})(?:\s+(CR|DR))?$/i;

const MONTHS = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

const SKIP_PATTERNS = [
  /^account statement$/i,
  /^for period:/i,
  /^account details$/i,
  /^account summary$/i,
  /^account activity$/i,
  /^account holder name/i,
  /^account type/i,
  /^account number/i,
  /^customer'?s address/i,
  /^branch name/i,
  /^ifsc$/i,
  /^account currency/i,
  /^opening balance/i,
  /^total credits/i,
  /^total debits/i,
  /^ending balance/i,
  /^date transaction details debits credits balance$/i,
  /^total inr/i,
  /^neft:/i,
  /^upi:/i,
  /^rtgs:/i,
  /^bbps:/i,
  /^imps:/i,
  /^\(rupees\b/i,
];

const STOP_PATTERNS = [/^ending balance/i, /^total inr/i];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmount(token) {
  if (!token || token === '-') return null;
  return Number(String(token).replace(/INR\s|,/g, ''));
}

function formatBalance(value, side = 'CR') {
  const formatted = Math.abs(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${side.toUpperCase()}`;
}

function normalizeDate(monthToken, dayToken, yearToken) {
  const month = MONTHS[monthToken.slice(0, 3).toLowerCase()] || '01';
  return `${String(dayToken).padStart(2, '0')}/${month}/${yearToken}`;
}

function parseFooter(line) {
  const normalized = line.replace(/\s+/g, ' ').trim();

  let match = normalized.match(FOOTER_RE);
  if (match) {
    return {
      debit: parseAmount(match[1]),
      credit: parseAmount(match[2]),
      balance: parseAmount(`INR ${match[3]}`),
      side: (match[4] || 'CR').toUpperCase(),
    };
  }

  match = normalized.match(CREDIT_ONLY_FOOTER_RE);
  if (match) {
    return {
      debit: null,
      credit: parseAmount(`INR ${match[1]}`),
      balance: parseAmount(`INR ${match[2]}`),
      side: (match[3] || 'CR').toUpperCase(),
    };
  }

  return null;
}

function splitInlineFooter(text) {
  const trimmed = text.trim();
  if (!trimmed) return { details: '', footer: null };

  const creditOnly = trimmed.match(/^(.+?)\s+-\s+INR\s([\d,]+\.\d{2})\s+INR\s([\d,]+\.\d{2})(?:\s+(CR|DR))?\s*$/i);
  if (creditOnly) {
    return {
      details: creditOnly[1].trim(),
      footer: {
        debit: null,
        credit: parseAmount(`INR ${creditOnly[2]}`),
        balance: parseAmount(`INR ${creditOnly[3]}`),
        side: (creditOnly[4] || 'CR').toUpperCase(),
      },
    };
  }

  const match = trimmed.match(/^(.+?)\s+(INR\s[\d,]+\.\d{2}|\-)\s+(INR\s[\d,]+\.\d{2}|\-)\s+INR\s([\d,]+\.\d{2})(?:\s+(CR|DR))?\s*$/i);
  if (match) {
    return {
      details: match[1].trim(),
      footer: {
        debit: parseAmount(match[2]),
        credit: parseAmount(match[3]),
        balance: parseAmount(`INR ${match[4]}`),
        side: (match[5] || 'CR').toUpperCase(),
      },
    };
  }

  const footerAtEnd = trimmed.match(INLINE_FOOTER_RE);
  if (footerAtEnd && footerAtEnd.index > 0) {
    const footer = parseFooter(footerAtEnd[0].trim());
    if (footer) {
      return {
        details: trimmed.slice(0, footerAtEnd.index).trim(),
        footer,
      };
    }
  }

  return { details: trimmed, footer: null };
}

/**
 * Parse Indian Bank "Account Activity" statement PDFs (MMM DD YYYY layout).
 */
export function parseIndianBankActivityStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let pending = null;
  let inActivity = false;

  const flush = (sideOverride) => {
    if (!pending?.footer) {
      pending = null;
      return;
    }

    const side = sideOverride || pending.footer.side || 'CR';
    rows.push({
      date: pending.date,
      details: pending.details.join(' ').replace(/\s+/g, ' ').trim(),
      debit: pending.footer.debit,
      credit: pending.footer.credit,
      balance: formatBalance(pending.footer.balance, side),
    });
    pending = null;
  };

  for (const raw of lines) {
    if (/^account activity$/i.test(raw)) {
      inActivity = true;
      continue;
    }
    if (/^date transaction details debits credits balance$/i.test(raw)) {
      inActivity = true;
      continue;
    }

    if (!inActivity) {
      if (DATE_START_RE.test(raw)) inActivity = true;
      else continue;
    }

    if (STOP_PATTERNS.some((re) => re.test(raw))) {
      flush();
      break;
    }
    if (shouldSkip(raw)) continue;

    if (/^(CR|DR)\.?$/i.test(raw)) {
      if (pending?.footer && !pending.footer.side) {
        pending.footer.side = raw.replace(/\./g, '').toUpperCase();
        flush();
      }
      continue;
    }

    const start = raw.match(DATE_START_RE);
    if (start) {
      flush();

      const date = normalizeDate(start[1], start[2], start[3]);
      const { details, footer } = splitInlineFooter(start[4] || '');

      pending = {
        date,
        details: details ? [details] : [],
        footer,
      };

      if (pending.footer?.side) {
        flush();
      }
      continue;
    }

    if (!pending) continue;

    const footer = parseFooter(raw);
    if (footer) {
      pending.footer = footer;
      if (footer.side) flush();
      continue;
    }

    pending.details.push(raw);
  }

  flush();
  return rows;
}

export const INDIAN_BANK_ACTIVITY_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'details', header: 'Transaction Details' },
  { key: 'debit', header: 'Debit (INR)' },
  { key: 'credit', header: 'Credit (INR)' },
  { key: 'balance', header: 'Balance' },
];

export function isIndianBankActivityFormat(text) {
  return (
    /ACCOUNT ACTIVITY/i.test(text) &&
    /Transaction Details\s+Debits\s+Credits\s+Balance/i.test(text) &&
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{4}/i.test(text)
  );
}
