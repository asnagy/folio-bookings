import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import { Badge } from '@folio/stripes/components';

/**
 * Maps booking status values to stripes Badge color variants.
 */
const STATUS_COLORS = {
  PENDING:          'default',
  RECALL_REQUIRED:  'red',
  RECALL_TRIGGERED: 'red',
  CONFIRMED:        'primary',
  ACTIVE:           'primary',
  COMPLETED:        'default',
  CANCELLED:        'default',
};

/**
 * BookingStatusBadge
 * Renders a coloured pill for the booking's overall status.
 */
const BookingStatusBadge = ({ status }) => {
  if (!status) return null;
  const color = STATUS_COLORS[status] || 'default';
  return (
    <Badge color={color}>
      <FormattedMessage id={`ui-bookings.status.${status.toLowerCase()}`} />
    </Badge>
  );
};

BookingStatusBadge.propTypes = {
  status: PropTypes.string,
};

BookingStatusBadge.defaultProps = {
  status: null,
};

export default BookingStatusBadge;
