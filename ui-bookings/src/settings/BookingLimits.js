import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useOkapiKy } from '@folio/stripes/core';
import {
  Button,
  Checkbox,
  Col,
  Loading,
  MessageBanner,
  Pane,
  PaneFooter,
  Row,
  TextField,
} from '@folio/stripes/components';

import useSettingsEntry from './useSettingsEntry';
import { parseLimit, serializeLimits } from './settingsUtils';

/**
 * Settings > Bookings > Booking limits.
 * Maximum number of active and future bookings a patron may hold, per patron group,
 * with a default for groups that have no limit of their own.
 */
const BookingLimits = () => {
  const intl = useIntl();
  const ky = useOkapiKy();
  const { value, isLoading, error, save, clearError } = useSettingsEntry('limits');
  const [groups, setGroups] = useState([]);
  const [defaultLimit, setDefaultLimit] = useState('');
  const [byGroup, setByGroup] = useState({});
  const [allowOverride, setAllowOverride] = useState(true);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    ky.get('groups', { searchParams: { query: 'cql.allRecords=1 sortby group', limit: 500 } }).json()
      .then(d => setGroups(d.usergroups || []))
      .catch(() => setGroups([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isLoading) return;
    setDefaultLimit(value?.defaultLimit ?? '');
    setByGroup(Object.fromEntries(Object.entries(value?.byPatronGroup || {}).map(([k, v]) => [k, String(v)])));
    setAllowOverride(value?.allowOverride !== false);
    setDirty(false);
  }, [isLoading, value]);

  const invalid = (text) => text !== '' && parseLimit(text) === null;
  const hasErrors = invalid(String(defaultLimit)) || Object.values(byGroup).some(invalid);

  const onSave = async () => {
    setSaved(false);
    if (await save(serializeLimits({ defaultLimit: String(defaultLimit), byGroup, allowOverride }))) {
      setSaved(true);
      setDirty(false);
    }
  };

  const edit = (setter) => (e) => { setter(e.target.value); setDirty(true); setSaved(false); };
  const numberError = intl.formatMessage({ id: 'ui-bookings.settings.limits.invalid' });

  return (
    <Pane
      id="bookings-settings-limits"
      defaultWidth="fill"
      paneTitle={<FormattedMessage id="ui-bookings.settings.limits" />}
      footer={(
        <PaneFooter
          renderEnd={(
            <Button
              id="save-booking-limits"
              buttonStyle="primary mega"
              disabled={!dirty || hasErrors}
              onClick={onSave}
            >
              <FormattedMessage id="ui-bookings.settings.save" />
            </Button>
          )}
        />
      )}
    >
      {isLoading ? <Loading size="large" /> : (
        <>
          {error && <MessageBanner type="error" onExited={clearError}>{error}</MessageBanner>}
          {saved && (
            <MessageBanner type="success" onExited={() => setSaved(false)}>
              <FormattedMessage id="ui-bookings.settings.saved" />
            </MessageBanner>
          )}
          <p><FormattedMessage id="ui-bookings.settings.limits.help" /></p>
          <Row>
            <Col xs={12} md={6}>
              <TextField
                id="default-booking-limit"
                type="number"
                min="0"
                label={<FormattedMessage id="ui-bookings.settings.limits.default" />}
                value={defaultLimit}
                onChange={edit(setDefaultLimit)}
                error={invalid(String(defaultLimit)) ? numberError : undefined}
              />
            </Col>
          </Row>
          <Row>
            <Col xs={12}>
              <Checkbox
                id="allow-limit-override"
                label={<FormattedMessage id="ui-bookings.settings.limits.allowOverride" />}
                checked={allowOverride}
                onChange={(e) => { setAllowOverride(e.target.checked); setDirty(true); setSaved(false); }}
              />
            </Col>
          </Row>
          <h3><FormattedMessage id="ui-bookings.settings.limits.byGroup" /></h3>
          {groups.map(g => (
            <Row key={g.id}>
              <Col xs={12} md={6}>
                <TextField
                  id={`limit-${g.id}`}
                  type="number"
                  min="0"
                  label={g.group}
                  placeholder={intl.formatMessage({ id: 'ui-bookings.settings.limits.useDefault' })}
                  value={byGroup[g.id] ?? ''}
                  onChange={(e) => { setByGroup({ ...byGroup, [g.id]: e.target.value }); setDirty(true); setSaved(false); }}
                  error={invalid(byGroup[g.id] ?? '') ? numberError : undefined}
                />
              </Col>
            </Row>
          ))}
        </>
      )}
    </Pane>
  );
};

export default BookingLimits;
