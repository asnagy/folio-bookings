import { inventoryItemPath } from './bookingUtils';

describe('inventoryItemPath', () => {
  it('builds the Inventory record view path', () => {
    expect(inventoryItemPath({ instanceId: 'i', holdingsRecordId: 'h', itemId: 'it' }))
      .toBe('/inventory/view/i/h/it');
  });

  it('falls back to an Inventory barcode search when ids are missing', () => {
    expect(inventoryItemPath({ itemId: 'it', itemBarcode: '39 001' }))
      .toBe('/inventory?qindex=items.barcode&query=39%20001');
  });

  it.each([[null], [{}], [{ instanceId: 'i', itemId: 'it' }]])('returns null with no ids and no barcode: %p', (item) => {
    expect(inventoryItemPath(item)).toBeNull();
  });
});
