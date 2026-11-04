import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import { Badge } from '@folio/stripes/components';

const RECALL_COLORS = {
  NOT_REQUIRED: 'default',
  REQUIRED:     'warn',
  TRIGGERED:    'warn',
  RETURNED:     'success',
};

/**
 * BookingRecallBadge
 * Renders the recall status for an individual booked item.
 */
const BookingRecallBadge = ({ status }) => {
  if (!status || status === 'NOT_REQUIRED') return <span>—</span>;
  const color = RECALL_COLORS[status] || 'default';
  return (
    <Badge color={color}>
      <FormattedMessage id={`ui-bookings.recallStatus.${status.toLowerCase()}`} />
    </Badge>
  );
};

BookingRecallBadge.propTypes = {
  status: PropTypes.string,
};

BookingRecallBadge.defaultProps = {
  status: 'NOT_REQUIRED',
};

export default BookingRecallBadge;
