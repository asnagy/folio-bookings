import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import {
  Button,
  Icon,
  MultiColumnList,
  NoValue,
} from '@folio/stripes/components';

import BookingRecallBadge from './BookingStatus/BookingRecallBadge';

const COLUMN_WIDTHS = {
  itemBarcode:  '15%',
  itemTitle:    '30%',
  callNumber:   '15%',
  itemStatus:   '15%',
  recallStatus: '15%',
  actions:      '10%',
};

const READ_ONLY_COLUMNS  = ['itemBarcode', 'itemTitle', 'callNumber', 'itemStatus', 'recallStatus'];
const EDIT_COLUMNS       = [...READ_ONLY_COLUMNS, 'actions'];

/**
 * BookingItemsTable
 *
 * Renders the list of items associated with a booking.
 * When readOnly=false, each row has a remove button.
 */
const BookingItemsTable = ({ items, onRemove, readOnly }) => {
  const visibleColumns = readOnly ? READ_ONLY_COLUMNS : EDIT_COLUMNS;

  const columnMapping = {
    itemBarcode:  <FormattedMessage id="ui-bookings.item.barcode" />,
    itemTitle:    <FormattedMessage id="ui-bookings.item.title" />,
    callNumber:   <FormattedMessage id="ui-bookings.item.callNumber" />,
    itemStatus:   <FormattedMessage id="ui-bookings.item.status" />,
    recallStatus: <FormattedMessage id="ui-bookings.item.recallStatus" />,
    actions:      '',
  };

  const formatter = {
    itemBarcode:  (row) => row.itemBarcode || <NoValue />,
    itemTitle:    (row) => row.itemTitle    || <NoValue />,
    callNumber:   (row) => row.callNumber   || <NoValue />,
    itemStatus:   (row) => row.itemStatus   || <NoValue />,
    recallStatus: (row) => <BookingRecallBadge status={row.recallStatus} />,
    actions:      (row, index) => (
      !readOnly && (
        <Button
          buttonStyle="none"
          id={`clickable-remove-item-${index}`}
          onClick={() => onRemove(index)}
          aria-label={<FormattedMessage id="ui-bookings.item.remove" />}
        >
          <Icon icon="times-circle" />
        </Button>
      )
    ),
  };

  return (
    <MultiColumnList
      id="booking-items-list"
      contentData={items}
      columnMapping={columnMapping}
      columnWidths={COLUMN_WIDTHS}
      formatter={formatter}
      visibleColumns={visibleColumns}
      isEmptyMessage={<FormattedMessage id="ui-bookings.items.empty" />}
    />
  );
};

BookingItemsTable.propTypes = {
  items:    PropTypes.arrayOf(PropTypes.object).isRequired,
  onRemove: PropTypes.func,
  readOnly: PropTypes.bool,
};

BookingItemsTable.defaultProps = {
  onRemove: null,
  readOnly: true,
};

export default BookingItemsTable;
