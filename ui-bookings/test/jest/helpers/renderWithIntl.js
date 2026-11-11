import React from 'react';
import { IntlProvider } from 'react-intl';
import { render } from '@folio/jest-config-stripes/testing-library/react';

import translations from '../../../translations/ui-bookings/en.json';

const prefixed = Object.fromEntries(
  Object.entries(translations).map(([key, value]) => [`ui-bookings.${key}`, value]),
);

const renderWithIntl = (children, renderer = render) => renderer(
  <IntlProvider locale="en" timeZone="UTC" messages={prefixed}>
    {children}
  </IntlProvider>,
);

export default renderWithIntl;
