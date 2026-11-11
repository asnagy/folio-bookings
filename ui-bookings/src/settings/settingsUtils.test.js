import { parseLimit, serializeLimits } from './settingsUtils';

describe('parseLimit', () => {
  it.each([['3', 3], [' 12 ', 12], ['0', 0], [7, 7]])('parses %p as %p', (text, expected) => {
    expect(parseLimit(text)).toBe(expected);
  });

  it.each(['', '  ', 'abc', '-1', '1.5', '1e3', null, undefined])('treats %p as not set', (text) => {
    expect(parseLimit(text)).toBeNull();
  });
});

describe('serializeLimits', () => {
  it('writes the shape read by mod-bookings-bl', () => {
    expect(serializeLimits({
      defaultLimit: '5',
      byGroup: { g1: '2', g2: '0' },
      allowOverride: true,
    })).toEqual({ defaultLimit: 5, byPatronGroup: { g1: 2, g2: 0 }, allowOverride: true });
  });

  it('leaves out blank and invalid group limits so the default applies', () => {
    expect(serializeLimits({ defaultLimit: '', byGroup: { g1: '', g2: 'x', g3: '4' }, allowOverride: false }))
      .toEqual({ byPatronGroup: { g3: 4 }, allowOverride: false });
  });

  it('copes with missing input', () => {
    expect(serializeLimits({})).toEqual({ byPatronGroup: {}, allowOverride: false });
  });
});
