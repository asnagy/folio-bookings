import {
  formatDateTimeDisplay,
  hasRecallItems,
  canActivateBooking,
} from '../../src/util/bookingUtils';

describe('bookingUtils', () => {
  describe('formatDateTimeDisplay', () => {
    it('returns "—" for falsy values', () => {
      expect(formatDateTimeDisplay(null)).toBe('—');
      expect(formatDateTimeDisplay('')).toBe('—');
      expect(formatDateTimeDisplay(undefined)).toBe('—');
    });

    it('formats a valid ISO string', () => {
      const result = formatDateTimeDisplay('2025-06-01T14:00:00Z');
      expect(result).toBeTruthy();
      expect(result).not.toBe('—');
    });
  });

  describe('hasRecallItems', () => {
    it('returns false for booking with no items', () => {
      expect(hasRecallItems({ items: [] })).toBe(false);
    });

    it('returns false when no items need recall', () => {
      const booking = { items: [{ recallStatus: 'NOT_REQUIRED' }] };
      expect(hasRecallItems(booking)).toBe(false);
    });

    it('returns true when an item has recall REQUIRED', () => {
      const booking = { items: [{ recallStatus: 'REQUIRED' }] };
      expect(hasRecallItems(booking)).toBe(true);
    });

    it('returns true when an item has recall TRIGGERED', () => {
      const booking = { items: [{ recallStatus: 'TRIGGERED' }] };
      expect(hasRecallItems(booking)).toBe(true);
    });
  });

  describe('canActivateBooking', () => {
    it('returns true for CONFIRMED status', () => {
      expect(canActivateBooking({ status: 'CONFIRMED' })).toBe(true);
    });

    it('returns true for PENDING status', () => {
      expect(canActivateBooking({ status: 'PENDING' })).toBe(true);
    });

    it('returns false for ACTIVE status', () => {
      expect(canActivateBooking({ status: 'ACTIVE' })).toBe(false);
    });

    it('returns false for COMPLETED status', () => {
      expect(canActivateBooking({ status: 'COMPLETED' })).toBe(false);
    });
  });
});
