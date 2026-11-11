import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import { Settings } from '@folio/stripes/smart-components';

import BookingLimits from './BookingLimits';
import BookingTiming from './BookingTiming';

/**
 * Settings > Bookings. Registered because stripes.actsAs includes "settings".
 * Values live in mod-settings (scope "mod-bookings") and are read by mod-bookings-bl.
 */
const BookingsSettings = (props) => {
  const pages = [
    {
      route: 'limits',
      label: <FormattedMessage id="ui-bookings.settings.limits" />,
      component: BookingLimits,
      perm: 'ui-bookings.settings.manage',
    },
    {
      route: 'timing',
      label: <FormattedMessage id="ui-bookings.settings.timing" />,
      component: BookingTiming,
      perm: 'ui-bookings.settings.manage',
    },
  ];

  return (
    <Settings
      {...props}
      pages={pages}
      paneTitle={<FormattedMessage id="ui-bookings.meta.title" />}
    />
  );
};

BookingsSettings.propTypes = {
  stripes: PropTypes.shape({
    connect: PropTypes.func,
  }),
};

export default BookingsSettings;
