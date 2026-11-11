/**
 * Minimal CSV export helpers (RFC 4180 quoting, UTF-8 BOM so Excel reads accents correctly).
 */

// Cells that start with these characters can be run as formulas by spreadsheet apps
const FORMULA_START = /^[=+\-@\t\r]/;

const escapeCell = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** @param {string[]} headers  @param {Array<Array<*>>} rows */
export const toCsv = (headers, rows) => [headers, ...rows]
  .map(row => row.map(escapeCell).join(','))
  .join('\r\n');

export const downloadCsv = (filename, csv) => {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const csvFilename = (prefix) => `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
