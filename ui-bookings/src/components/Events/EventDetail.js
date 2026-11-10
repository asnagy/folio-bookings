import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, useIntl } from 'react-intl';
import { useOkapiKy } from '@folio/stripes/core';
import {
  Button,
  Col,
  ConfirmationModal,
  Icon,
  KeyValue,
  Loading,
  MessageBanner,
  Pane,
  PaneMenu,
  Row,
} from '@folio/stripes/components';

import { formatDateTimeDisplay } from '../../util/bookingUtils';

const EventDetail = ({ eventId, canEdit, onClose, onEdit, onDeleted }) => {
  const intl = useIntl();
  const ky = useOkapiKy();
  const [event, setEvent] = useState(null);
  const [bookingCount, setBookingCount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setBookingCount(null);
    Promise.all([
      ky.get(`bookings/events/${eventId}`).json(),
      ky.get('bookings/bookings', { searchParams: { query: `eventId==${eventId}`, limit: 1 } }).json()
        .then(d => d.totalRecords).catch(() => null),
    ]).then(([ev, count]) => {
      if (cancelled) return;
      setEvent(ev);
      setBookingCount(count);
      setIsLoading(false);
    }).catch(() => { if (!cancelled) { setEvent(null); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    setConfirmDelete(false);
    setActionError(null);
    try {
      await ky.delete(`bookings/events/${eventId}`);
      onDeleted();
    } catch (err) {
      let message = err.message;
      try {
        const body = await err.response?.json();
        message = body?.errors?.[0]?.message || message;
      } catch (e) { /* keep default */ }
      setActionError(message);
    }
  };

  const firstMenu = (
    <PaneMenu>
      <Button
        id="clickable-close-event-detail"
        buttonStyle="none"
        onClick={onClose}
        aria-label={intl.formatMessage({ id: 'ui-bookings.action.close' })}
      >
        <Icon icon="times" />
      </Button>
    </PaneMenu>
  );

  if (isLoading) {
    return (
      <Pane id="event-detail-pane" defaultWidth="44%" firstMenu={firstMenu} paneTitle={<FormattedMessage id="ui-bookings.booking.loading" />}>
        <Loading size="xlarge" />
      </Pane>
    );
  }

  if (!event) {
    return (
      <Pane id="event-detail-pane" defaultWidth="44%" firstMenu={firstMenu} paneTitle={<FormattedMessage id="ui-bookings.event.notFound" />}>
        <MessageBanner type="error"><FormattedMessage id="ui-bookings.event.notFound" /></MessageBanner>
      </Pane>
    );
  }

  const actionMenu = canEdit ? ({ onToggle }) => (
    <>
      <Button buttonStyle="dropdownItem" id="clickable-edit-event" onClick={() => { onToggle(); onEdit(); }}>
        <Icon icon="edit"><FormattedMessage id="ui-bookings.action.edit" /></Icon>
      </Button>
      <Button buttonStyle="dropdownItem" id="clickable-delete-event" onClick={() => { onToggle(); setConfirmDelete(true); }}>
        <Icon icon="trash"><FormattedMessage id="ui-bookings.action.delete" /></Icon>
      </Button>
    </>
  ) : null;

  return (
    <Pane
      id="event-detail-pane"
      defaultWidth="44%"
      firstMenu={firstMenu}
      actionMenu={actionMenu}
      paneTitle={event.name}
    >
      {actionError && (
        <MessageBanner type="error" onExited={() => setActionError(null)}>{actionError}</MessageBanner>
      )}
      <Row>
        <Col xs={12}>
          <KeyValue label={<FormattedMessage id="ui-bookings.event.name" />} value={event.name} />
        </Col>
      </Row>
      <Row>
        <Col xs={12}>
          <KeyValue label={<FormattedMessage id="ui-bookings.event.description" />} value={event.description || '—'} />
        </Col>
      </Row>
      <Row>
        <Col xs={6}>
          <KeyValue label={<FormattedMessage id="ui-bookings.event.startDate" />} value={formatDateTimeDisplay(event.startDate)} />
        </Col>
        <Col xs={6}>
          <KeyValue label={<FormattedMessage id="ui-bookings.event.endDate" />} value={formatDateTimeDisplay(event.endDate)} />
        </Col>
      </Row>
      <Row>
        <Col xs={12}>
          <KeyValue label={<FormattedMessage id="ui-bookings.event.bookingCount" />} value={bookingCount ?? '—'} />
        </Col>
      </Row>
      <ConfirmationModal
        id="confirm-delete-event"
        open={confirmDelete}
        heading={<FormattedMessage id="ui-bookings.event.delete.heading" />}
        message={<FormattedMessage id="ui-bookings.event.delete.message" values={{ name: event.name }} />}
        confirmLabel={<FormattedMessage id="ui-bookings.action.delete" />}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </Pane>
  );
};

EventDetail.propTypes = {
  eventId: PropTypes.string.isRequired,
  canEdit: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDeleted: PropTypes.func.isRequired,
};

EventDetail.defaultProps = { canEdit: false };

export default EventDetail;
