import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import { Button } from '@folio/stripes/components';

import css from './ViewSwitcher.css';

const VIEWS = ['bookings', 'events'];

/**
 * Bookings / Events switch shown at the top of the search pane,
 * following the Courses / Reserves switch in the Courses app.
 * Built from plain Buttons so it only depends on components every Stripes version exports.
 */
const ViewSwitcher = ({ active, onChange }) => (
  <div className={css.switcher} role="group">
    {VIEWS.map(view => (
      <Button
        key={view}
        id={`view-switch-${view}`}
        buttonStyle={active === view ? 'primary' : 'default'}
        aria-pressed={active === view}
        buttonClass={css.switchButton}
        marginBottom0
        onClick={() => { if (view !== active) onChange(view); }}
      >
        <FormattedMessage id={`ui-bookings.view.${view}`} />
      </Button>
    ))}
  </div>
);

ViewSwitcher.propTypes = {
  active: PropTypes.oneOf(VIEWS).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default ViewSwitcher;
