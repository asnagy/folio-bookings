import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import { Button, KeyValue } from '@folio/stripes/components';
import { Pluggable } from '@folio/stripes/core';

const displayName = (u) => {
  if (!u) return '';
  const last = u.personal?.lastName ?? u.lastName;
  const first = u.personal?.firstName ?? u.firstName;
  return last ? `${last}${first ? `, ${first}` : ''}` : (u.barcode || u.id);
};

/**
 * Optional "pick up by" user: someone other than the patron who will collect the items.
 * Uses the same find-user plugin, shown as a link, as the patron look-up.
 */
const PickupByLookup = ({ user, onSelectUser }) => (
  <>
    {user && (
      <KeyValue
        label={<FormattedMessage id="ui-bookings.booking.pickupBy" />}
        value={displayName(user)}
      />
    )}
    {user ? (
      <Button id="clickable-clear-pickup-by" buttonStyle="link" marginBottom0 onClick={() => onSelectUser(null)}>
        <FormattedMessage id="ui-bookings.booking.pickupByClear" />
      </Button>
    ) : (
      <Pluggable
        aria-haspopup="true"
        type="find-user"
        id="clickable-find-pickup-by"
        searchLabel={<FormattedMessage id="ui-bookings.booking.pickupByLookUp" />}
        searchButtonStyle="link"
        marginTop0
        selectUser={onSelectUser}
        visibleColumns={['active', 'name', 'patronGroup', 'username', 'barcode']}
      >
        <Button buttonStyle="link" id="clickable-find-pickup-by-fallback">
          <FormattedMessage id="ui-bookings.booking.pickupByLookUp" />
        </Button>
      </Pluggable>
    )}
  </>
);

PickupByLookup.propTypes = {
  user: PropTypes.object,
  onSelectUser: PropTypes.func.isRequired,
};

export default PickupByLookup;
