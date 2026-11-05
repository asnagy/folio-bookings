import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  Button,
  Col,
  Icon,
  KeyValue,
  MessageBanner,
  Row,
  TextField,
} from '@folio/stripes/components';
import { Pluggable, useOkapiKy } from '@folio/stripes/core';

/**
 * PatronLookup
 *
 * Provides two ways to identify a patron for a booking:
 *   1. Barcode/username text field (press Enter or click the search icon)
 *   2. <Pluggable type="find-user"> modal for name/group search
 *
 * Once a patron is selected, renders a read-only summary with a
 * "Clear" button to start over.
 */
const PatronLookup = ({ patron, onSelectPatron }) => {
  const intl = useIntl();
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lookupError, setLookupError]   = useState(null);
  const [isSearching, setIsSearching]   = useState(false);

  const ky = useOkapiKy();

  const lookupByBarcode = async () => {
    if (!barcodeInput.trim()) return;
    setLookupError(null);
    setIsSearching(true);
    try {
      const data = await ky.get('users', {
        searchParams: { query: `barcode=="${barcodeInput.trim()}"`, limit: 1 },
      }).json();
      if (!data.users || data.users.length === 0) {
        setLookupError(intl.formatMessage(
          { id: 'ui-bookings.error.patronNotFound' },
          { barcode: barcodeInput }
        ));
      } else {
        onSelectPatron(data.users[0]);
        setBarcodeInput('');
      }
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  // Patron already selected — show summary
  if (patron) {
    const last = patron.personal?.lastName ?? patron.lastName;
    const first = patron.personal?.firstName ?? patron.firstName;
    const patronName = last
      ? `${last}${first ? `, ${first}` : ''}`
      : patron.id;

    return (
      <>
        <Row>
          <Col xs={4}>
            <KeyValue
              label={<FormattedMessage id="ui-bookings.patron.name" />}
              value={patronName}
            />
          </Col>
          <Col xs={4}>
            <KeyValue
              label={<FormattedMessage id="ui-bookings.patron.barcode" />}
              value={patron.barcode || '—'}
            />
          </Col>
          <Col xs={4}>
            <KeyValue
              label={<FormattedMessage id="ui-bookings.patron.patronGroup" />}
              value={patron.patronGroup || '—'}
            />
          </Col>
        </Row>
        <Row>
          <Col xs={12}>
            <Button
              id="clickable-clear-patron"
              buttonStyle="default"
              onClick={() => onSelectPatron(null)}
            >
              <FormattedMessage id="ui-bookings.patron.clear" />
            </Button>
          </Col>
        </Row>
      </>
    );
  }

  // No patron selected — show lookup controls
  return (
    <>
      <Row>
        <Col xs={8}>
          <TextField
            id="patron-barcode-field"
            label={<FormattedMessage id="ui-bookings.patron.barcodeEntry" />}
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                lookupByBarcode();
              }
            }}
            endControl={
              <Button
                buttonStyle="none"
                id="clickable-patron-barcode-search"
                marginBottom0
                onClick={lookupByBarcode}
                disabled={isSearching}
                aria-label={intl.formatMessage({ id: 'ui-bookings.action.search' })}
              >
                {isSearching
                  ? <Icon icon="spinner-ellipsis" />
                  : <Icon icon="search" />}
              </Button>
            }
          />
        </Col>
        <Col xs={4} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '1rem' }}>
          {/*
           * find-user plugin — opens a patron search modal identical to
           * the one used in ui-requests and ui-checkout.
           */}
          <Pluggable
            type="find-user"
            id="clickable-find-user"
            searchLabel={<FormattedMessage id="ui-bookings.patron.lookUp" />}
            selectUser={onSelectPatron}
            visibleColumns={['active', 'name', 'patronGroup', 'username', 'barcode']}
          >
            <Button id="clickable-find-user-fallback">
              <FormattedMessage id="ui-bookings.patron.lookUp" />
            </Button>
          </Pluggable>
        </Col>
      </Row>

      {lookupError && (
        <Row>
          <Col xs={12}>
            <MessageBanner type="error" onExited={() => setLookupError(null)}>
              {lookupError}
            </MessageBanner>
          </Col>
        </Row>
      )}
    </>
  );
};

PatronLookup.propTypes = {
  patron:         PropTypes.object,
  onSelectPatron: PropTypes.func.isRequired,
};

PatronLookup.defaultProps = {
  patron: null,
};

export default PatronLookup;
