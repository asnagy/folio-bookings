import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  Button,
  Col,
  Loading,
  MessageBanner,
  Pane,
  PaneFooter,
  Row,
  TextField,
} from '@folio/stripes/components';

import useSettingsEntry from './useSettingsEntry';
import { DEFAULT_RECALL_LEAD_DAYS, DEFAULT_CHECKOUT_LEAD_MINUTES, parseLimit } from './settingsUtils';

/** Settings > Bookings > Recall and check-out timing. */
const BookingTiming = () => {
  const intl = useIntl();
  const { value, isLoading, error, save, clearError } = useSettingsEntry('timing');
  const [recallDays, setRecallDays] = useState(String(DEFAULT_RECALL_LEAD_DAYS));
  const [checkoutMinutes, setCheckoutMinutes] = useState(String(DEFAULT_CHECKOUT_LEAD_MINUTES));
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    setRecallDays(String(value?.recallLeadDays ?? DEFAULT_RECALL_LEAD_DAYS));
    setCheckoutMinutes(String(value?.checkoutLeadMinutes ?? DEFAULT_CHECKOUT_LEAD_MINUTES));
    setDirty(false);
  }, [isLoading, value]);

  const recallInvalid = parseLimit(recallDays) === null;
  const checkoutInvalid = parseLimit(checkoutMinutes) === null;
  const numberError = intl.formatMessage({ id: 'ui-bookings.settings.timing.invalid' });

  const onSave = async () => {
    setSaved(false);
    const ok = await save({
      recallLeadDays: parseLimit(recallDays),
      checkoutLeadMinutes: parseLimit(checkoutMinutes),
    });
    if (ok) { setSaved(true); setDirty(false); }
  };

  return (
    <Pane
      id="bookings-settings-timing"
      defaultWidth="fill"
      paneTitle={<FormattedMessage id="ui-bookings.settings.timing" />}
      footer={(
        <PaneFooter
          renderEnd={(
            <Button
              id="save-booking-timing"
              buttonStyle="primary mega"
              disabled={!dirty || recallInvalid || checkoutInvalid}
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
          <Row>
            <Col xs={12} md={6}>
              <TextField
                id="recall-lead-days"
                type="number"
                min="0"
                label={<FormattedMessage id="ui-bookings.settings.timing.recallLeadDays" />}
                value={recallDays}
                onChange={(e) => { setRecallDays(e.target.value); setDirty(true); setSaved(false); }}
                error={recallInvalid ? numberError : undefined}
              />
              <p><FormattedMessage id="ui-bookings.settings.timing.recallHelp" /></p>
            </Col>
          </Row>
          <Row>
            <Col xs={12} md={6}>
              <TextField
                id="checkout-lead-minutes"
                type="number"
                min="0"
                label={<FormattedMessage id="ui-bookings.settings.timing.checkoutLeadMinutes" />}
                value={checkoutMinutes}
                onChange={(e) => { setCheckoutMinutes(e.target.value); setDirty(true); setSaved(false); }}
                error={checkoutInvalid ? numberError : undefined}
              />
              <p><FormattedMessage id="ui-bookings.settings.timing.checkoutHelp" /></p>
            </Col>
          </Row>
        </>
      )}
    </Pane>
  );
};

export default BookingTiming;
