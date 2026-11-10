import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import { Button, SegmentedControl } from '@folio/stripes/components';

/**
 * Bookings / Events switch shown at the top of the search pane,
 * the same pattern as the Courses / Reserves switch in the Courses app.
 */
const ViewSwitcher = ({ active, onChange }) => (
  <SegmentedControl
    activeId={active}
    onActivate={({ id }) => { if (id !== active) onChange(id); }}
  >
    <Button id="bookings" data-test-view-bookings>
      <FormattedMessage id="ui-bookings.view.bookings" />
    </Button>
    <Button id="events" data-test-view-events>
      <FormattedMessage id="ui-bookings.view.events" />
    </Button>
  </SegmentedControl>
);

ViewSwitcher.propTypes = {
  active: PropTypes.oneOf(['bookings', 'events']).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default ViewSwitcher;
