import React from 'react';
import { Route, Switch } from 'react-router-dom';
import PropTypes from 'prop-types';

import BookingsApp from './components/BookingsApp';
import Settings from './settings';

/*
 * ui-bookings entry point.
 *
 * Following FOLIO convention (stripes dev guide), all routes are declared
 * here in the top-level index.js rather than nested throughout the tree.
 * stripes-core reads `stripes.route` from package.json ("/bookings") and
 * mounts this component at that path.
 */

const BookingsModule = (props) => {
  const { showSettings, match } = props;

  if (showSettings) {
    return <Settings {...props} />;
  }

  return (
    <Switch>
      <Route
        path={`${match.path}`}
        render={(routeProps) => (
          <BookingsApp
            {...props}
            {...routeProps}
          />
        )}
      />
    </Switch>
  );
};

BookingsModule.propTypes = {
  match: PropTypes.shape({
    path: PropTypes.string.isRequired,
  }).isRequired,
  showSettings: PropTypes.bool,
};

BookingsModule.defaultProps = {
  showSettings: false,
};

export default BookingsModule;
