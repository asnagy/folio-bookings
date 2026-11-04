import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import { Settings } from '@folio/stripes/smart-components';

/**
 * Settings entry point for ui-bookings.
 * Registered because stripes.actsAs includes "settings".
 * Currently provides a placeholder — future settings sections
 * (e.g. default pickup service point, booking lead time limits) go here.
 */
const BookingsSettings = (props) => {
  const pages = [
    // Future settings sections are added to this array, e.g.:
    // {
    //   route: 'general',
    //   label: <FormattedMessage id="ui-bookings.settings.general" />,
    //   component: GeneralSettings,
    // },
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
