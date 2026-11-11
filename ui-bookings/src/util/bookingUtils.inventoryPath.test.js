import { inventoryItemPath } from './bookingUtils';

describe('inventoryItemPath', () => {
  it('builds the Inventory record view path', () => {
    expect(inventoryItemPath({ instanceId: 'i', holdingsRecordId: 'h', itemId: 'it' }))
      .toBe('/inventory/view/i/h/it');
  });

  it.each([
    [null],
    [{}],
    [{ instanceId: 'i', itemId: 'it' }],
    [{ instanceId: 'i', holdingsRecordId: 'h' }],
  ])('returns null when ids are missing: %p', (item) => {
    expect(inventoryItemPath(item)).toBeNull();
  });
});
