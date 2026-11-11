import { toCsv, csvFilename } from './csv';

describe('toCsv', () => {
  it('joins rows with CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, 2], [3, 4]])).toBe('a,b\r\n1,2\r\n3,4');
  });

  it('quotes cells containing commas, quotes and newlines', () => {
    expect(toCsv(['x'], [['a,b'], ['say "hi"'], ['l1\nl2']]))
      .toBe('x\r\n"a,b"\r\n"say ""hi"""\r\n"l1\nl2"');
  });

  it('renders null and undefined as empty cells', () => {
    expect(toCsv(['a', 'b'], [[null, undefined]])).toBe('a,b\r\n,');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(toCsv(['x'], [['=SUM(A1)'], ['+1'], ['@cmd'], ['-2']]))
      .toBe("x\r\n'=SUM(A1)\r\n'+1\r\n'@cmd\r\n'-2");
  });
});

describe('csvFilename', () => {
  it('appends today\'s date', () => {
    expect(csvFilename('bookings')).toMatch(/^bookings-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
