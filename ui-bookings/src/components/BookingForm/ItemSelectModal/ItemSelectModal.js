import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  Button,
  Checkbox,
  Modal,
  ModalFooter,
  MultiColumnList,
  NoValue,
} from '@folio/stripes/components';

const COLUMNS = ['select', 'barcode', 'status', 'callNumber', 'copyVolume', 'location', 'materialType'];

const itemCallNumber = (item) => item.effectiveCallNumberComponents?.callNumber || item.callNumber || '';
const itemCopyVolume = (item) => [item.copyNumber && `c.${item.copyNumber}`, item.volume, item.enumeration]
  .filter(Boolean).join(' ');
const itemLocation = (item) => item.effectiveLocation?.name || item.permanentLocation?.name || '';

/**
 * ItemSelectModal
 *
 * Shown after a title is chosen in "Title look-up": lists every item record (copy) of that title
 * so staff can tick the specific item(s) to link to the booking.
 */
const ItemSelectModal = ({ open, instance, items, existingItemIds, onClose, onAdd }) => {
  const intl = useIntl();
  const [selected, setSelected] = useState({});

  useEffect(() => {
    if (open) setSelected({});
  }, [open, instance?.id]);

  const selectedItems = items.filter(i => selected[i.id]);

  const toggle = (item) => setSelected(prev => ({ ...prev, [item.id]: !prev[item.id] }));

  const formatter = {
    select: (item) => {
      const already = existingItemIds.includes(item.id);
      return (
        <Checkbox
          aria-label={intl.formatMessage({ id: 'ui-bookings.item.select' })}
          checked={already || Boolean(selected[item.id])}
          disabled={already}
          onChange={() => toggle(item)}
          title={already ? intl.formatMessage({ id: 'ui-bookings.item.picker.alreadyAdded' }) : undefined}
        />
      );
    },
    barcode:      (item) => item.barcode || <NoValue />,
    status:       (item) => item.status?.name || <NoValue />,
    callNumber:   (item) => itemCallNumber(item) || <NoValue />,
    copyVolume:   (item) => itemCopyVolume(item) || <NoValue />,
    location:     (item) => itemLocation(item) || <NoValue />,
    materialType: (item) => item.materialType?.name || <NoValue />,
  };

  const columnMapping = {
    select:       '',
    barcode:      <FormattedMessage id="ui-bookings.item.barcode" />,
    status:       <FormattedMessage id="ui-bookings.item.status" />,
    callNumber:   <FormattedMessage id="ui-bookings.item.callNumber" />,
    copyVolume:   <FormattedMessage id="ui-bookings.item.copyVolume" />,
    location:     <FormattedMessage id="ui-bookings.item.location" />,
    materialType: <FormattedMessage id="ui-bookings.item.materialType" />,
  };

  const footer = (
    <ModalFooter>
      <Button
        buttonStyle="primary"
        id="clickable-add-selected-items"
        disabled={selectedItems.length === 0}
        onClick={() => onAdd(selectedItems)}
      >
        <FormattedMessage id="ui-bookings.item.picker.add" values={{ count: selectedItems.length }} />
      </Button>
      <Button id="clickable-cancel-item-picker" onClick={onClose}>
        <FormattedMessage id="ui-bookings.action.cancel" />
      </Button>
    </ModalFooter>
  );

  return (
    <Modal
      id="item-select-modal"
      open={open}
      size="large"
      dismissible
      onClose={onClose}
      label={<FormattedMessage id="ui-bookings.item.picker.title" values={{ title: instance?.title || '' }} />}
      footer={footer}
    >
      <MultiColumnList
        id="item-select-list"
        contentData={items}
        columnMapping={columnMapping}
        formatter={formatter}
        visibleColumns={COLUMNS}
        columnWidths={{ select: '6%', barcode: '16%', status: '14%', callNumber: '18%', copyVolume: '14%', location: '20%', materialType: '12%' }}
        isEmptyMessage={<FormattedMessage id="ui-bookings.error.noItemsForInstance" />}
        onRowClick={(_, item) => { if (!existingItemIds.includes(item.id)) toggle(item); }}
      />
    </Modal>
  );
};

ItemSelectModal.propTypes = {
  open:            PropTypes.bool.isRequired,
  instance:        PropTypes.object,
  items:           PropTypes.arrayOf(PropTypes.object),
  existingItemIds: PropTypes.arrayOf(PropTypes.string),
  onClose:         PropTypes.func.isRequired,
  onAdd:           PropTypes.func.isRequired,
};

ItemSelectModal.defaultProps = {
  instance: null,
  items: [],
  existingItemIds: [],
};

export default ItemSelectModal;
