import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import {
  Accordion,
  AccordionSet,
  AccordionStatus,
  Button,
  Col,
  ConfirmationModal,
  ExpandAllButton,
  Icon,
  KeyValue,
  Loading,
  MessageBanner,
  Pane,
  PaneFooter,
  PaneMenu,
  Row,
} from '@folio/stripes/components';

import BookingItemsTable from '../BookingItemsTable';
import BookingStatusBadge from '../BookingStatus/BookingStatusBadge';
import { formatDateTimeDisplay, getBookingStatusLabel } from '../../util/bookingUtils';

/**
 * BookingDetail
 *
 * Third-pane detail view for a single booking record.
 * Displays booking metadata, patron summary, and the list of booked items.
 * Provides Edit, Delete, and Activate actions per user permissions.
 */
const BookingDetail = (props) => {
  const {
    bookingId,
    stripes,
    mutator,
    onClose,
    onEdit,
    onDelete,
    canEdit,
    canDelete,
  } = props;

  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [activateConfirmOpen, setActivateConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState(null);

  const canActivate = stripes.hasPerm('ui-bookings.create-edit');

  // Accordion expand/collapse state
  const [sections, setSections] = useState({
    bookingInfo: true,
    patronInfo: true,
    itemsInfo: true,
  });

  // ------------------------------------------------------------------
  // Fetch booking on mount / id change
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!bookingId) return;
    setIsLoading(true);
    setActionError(null);

    fetch(`${stripes.okapi.url}/bookings/bookings/${bookingId}`, {
      headers: {
        'X-Okapi-Tenant': stripes.okapi.tenant,
        'X-Okapi-Token': stripes.store.getState().okapi.token,
        'Content-Type': 'application/json',
      },
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setBooking(data);
        setIsLoading(false);
      })
      .catch(err => {
        setActionError(err.message);
        setIsLoading(false);
      });
  }, [bookingId, stripes]);

  // ------------------------------------------------------------------
  // Delete handler
  // ------------------------------------------------------------------

  const handleDelete = () => {
    setIsDeleting(true);
    fetch(`${stripes.okapi.url}/bookings/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: {
        'X-Okapi-Tenant': stripes.okapi.tenant,
        'X-Okapi-Token': stripes.store.getState().okapi.token,
      },
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setDeleteConfirmOpen(false);
        onDelete();
      })
      .catch(err => {
        setActionError(err.message);
        setIsDeleting(false);
        setDeleteConfirmOpen(false);
      });
  };

  // ------------------------------------------------------------------
  // Activate (manual checkout trigger)
  // ------------------------------------------------------------------

  const handleActivate = () => {
    setActivateConfirmOpen(false);
    setActionError(null);

    fetch(`${stripes.okapi.url}/bookings/bookings/${bookingId}/activate`, {
      method: 'POST',
      headers: {
        'X-Okapi-Tenant': stripes.okapi.tenant,
        'X-Okapi-Token': stripes.store.getState().okapi.token,
        'Content-Type': 'application/json',
      },
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(updated => setBooking(updated))
      .catch(err => setActionError(err.message));
  };

  // ------------------------------------------------------------------
  // Pane action menus
  // ------------------------------------------------------------------

  const actionMenu = ({ onToggle }) => (
    <>
      {canEdit && (
        <Button
          buttonStyle="dropdownItem"
          id="clickable-edit-booking"
          onClick={() => { onToggle(); onEdit(); }}
        >
          <Icon icon="edit">
            <FormattedMessage id="ui-bookings.action.edit" />
          </Icon>
        </Button>
      )}
      {canActivate && booking?.status !== 'ACTIVE' && booking?.status !== 'COMPLETED' && (
        <Button
          buttonStyle="dropdownItem"
          id="clickable-activate-booking"
          onClick={() => { onToggle(); setActivateConfirmOpen(true); }}
        >
          <Icon icon="play">
            <FormattedMessage id="ui-bookings.action.activate" />
          </Icon>
        </Button>
      )}
      {canDelete && (
        <Button
          buttonStyle="dropdownItem"
          id="clickable-delete-booking"
          onClick={() => { onToggle(); setDeleteConfirmOpen(true); }}
        >
          <Icon icon="trash">
            <FormattedMessage id="ui-bookings.action.delete" />
          </Icon>
        </Button>
      )}
    </>
  );

  const firstMenu = (
    <PaneMenu>
      <Button
        id="clickable-close-booking-detail"
        onClick={onClose}
        buttonStyle="none"
        aria-label={<FormattedMessage id="ui-bookings.action.close" />}
      >
        <Icon icon="times" />
      </Button>
    </PaneMenu>
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (isLoading) {
    return (
      <Pane
        id="booking-detail-pane"
        defaultWidth="44%"
        firstMenu={firstMenu}
        paneTitle={<FormattedMessage id="ui-bookings.booking.loading" />}
      >
        <Loading size="xlarge" />
      </Pane>
    );
  }

  if (!booking) {
    return (
      <Pane
        id="booking-detail-pane"
        defaultWidth="44%"
        firstMenu={firstMenu}
        paneTitle={<FormattedMessage id="ui-bookings.booking.notFound" />}
      >
        <MessageBanner type="error">
          <FormattedMessage id="ui-bookings.booking.notFound" />
        </MessageBanner>
      </Pane>
    );
  }

  const patron = booking.patron || {};
  const patronName = patron.lastName
    ? `${patron.lastName}, ${patron.firstName || ''}`.trim().replace(/,\s*$/, '')
    : booking.userId;

  return (
    <Pane
      id="booking-detail-pane"
      defaultWidth="44%"
      firstMenu={firstMenu}
      actionMenu={actionMenu}
      paneTitle={
        <FormattedMessage
          id="ui-bookings.booking.detailTitle"
          values={{ patron: patronName }}
        />
      }
      paneSub={<BookingStatusBadge status={booking.status} />}
    >
      {actionError && (
        <MessageBanner type="error" onExited={() => setActionError(null)}>
          {actionError}
        </MessageBanner>
      )}

      <AccordionStatus>
        {({ expanded, toggleAll }) => (
          <>
            <Row end="xs">
              <Col xs>
                <ExpandAllButton
                  accordionStatus={sections}
                  onToggle={toggleAll}
                />
              </Col>
            </Row>

            <AccordionSet accordionStatus={sections} onToggle={(id) => setSections(prev => ({ ...prev, [id]: !prev[id] }))}>

              {/* ---- Booking Information ---- */}
              <Accordion
                id="bookingInfo"
                label={<FormattedMessage id="ui-bookings.accordion.bookingInfo" />}
              >
                <Row>
                  <Col xs={6}>
                    <KeyValue
                      label={<FormattedMessage id="ui-bookings.booking.status" />}
                      value={<BookingStatusBadge status={booking.status} />}
                    />
                  </Col>
                  <Col xs={6}>
                    <KeyValue
                      label={<FormattedMessage id="ui-bookings.booking.pickupServicePoint" />}
                      value={booking.pickupServicePointId || '—'}
                    />
                  </Col>
                </Row>
                <Row>
                  <Col xs={6}>
                    <KeyValue
                      label={<FormattedMessage id="ui-bookings.booking.startDate" />}
                      value={formatDateTimeDisplay(booking.startDate)}
                    />
                  </Col>
                  <Col xs={6}>
                    <KeyValue
                      label={<FormattedMessage id="ui-bookings.booking.endDate" />}
                      value={formatDateTimeDisplay(booking.endDate)}
                    />
                  </Col>
                </Row>
                {booking.notes && (
                  <Row>
                    <Col xs={12}>
                      <KeyValue
                        label={<FormattedMessage id="ui-bookings.booking.notes" />}
                        value={booking.notes}
                      />
                    </Col>
                  </Row>
                )}
                <Row>
                  <Col xs={6}>
                    <KeyValue
                      label={<FormattedMessage id="ui-bookings.booking.createdDate" />}
                      value={formatDateTimeDisplay(booking.metadata?.createdDate)}
                    />
                  </Col>
                  <Col xs={6}>
                    <KeyValue
                      label={<FormattedMessage id="ui-bookings.booking.updatedDate" />}
                      value={formatDateTimeDisplay(booking.metadata?.updatedDate)}
                    />
                  </Col>
                </Row>
              </Accordion>

              {/* ---- Patron Information ---- */}
              <Accordion
                id="patronInfo"
                label={<FormattedMessage id="ui-bookings.accordion.patronInfo" />}
              >
                <Row>
                  <Col xs={6}>
                    <KeyValue
                      label={<FormattedMessage id="ui-bookings.patron.name" />}
                      value={patronName}
                    />
                  </Col>
                  <Col xs={6}>
                    <KeyValue
                      label={<FormattedMessage id="ui-bookings.patron.barcode" />}
                      value={patron.barcode || '—'}
                    />
                  </Col>
                </Row>
                <Row>
                  <Col xs={6}>
                    <KeyValue
                      label={<FormattedMessage id="ui-bookings.patron.patronGroup" />}
                      value={patron.patronGroup || '—'}
                    />
                  </Col>
                  <Col xs={6}>
                    <KeyValue
                      label={<FormattedMessage id="ui-bookings.patron.id" />}
                      value={booking.userId}
                    />
                  </Col>
                </Row>
              </Accordion>

              {/* ---- Booked Items ---- */}
              <Accordion
                id="itemsInfo"
                label={
                  <FormattedMessage
                    id="ui-bookings.accordion.items"
                    values={{ count: booking.items?.length || 0 }}
                  />
                }
              >
                <BookingItemsTable
                  items={booking.items || []}
                  readOnly
                />
              </Accordion>

            </AccordionSet>
          </>
        )}
      </AccordionStatus>

      {/* ---- Modals ---- */}

      <ConfirmationModal
        id="delete-booking-confirmation"
        open={deleteConfirmOpen}
        heading={<FormattedMessage id="ui-bookings.confirm.delete.heading" />}
        message={
          <FormattedMessage
            id="ui-bookings.confirm.delete.message"
            values={{ patron: patronName }}
          />
        }
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
        confirmLabel={<FormattedMessage id="ui-bookings.action.delete" />}
        isConfirmButtonDisabled={isDeleting}
      />

      <ConfirmationModal
        id="activate-booking-confirmation"
        open={activateConfirmOpen}
        heading={<FormattedMessage id="ui-bookings.confirm.activate.heading" />}
        message={<FormattedMessage id="ui-bookings.confirm.activate.message" />}
        onConfirm={handleActivate}
        onCancel={() => setActivateConfirmOpen(false)}
        confirmLabel={<FormattedMessage id="ui-bookings.action.activate" />}
      />
    </Pane>
  );
};

BookingDetail.propTypes = {
  bookingId: PropTypes.string.isRequired,
  stripes:   PropTypes.object.isRequired,
  mutator:   PropTypes.object.isRequired,
  onClose:   PropTypes.func.isRequired,
  onEdit:    PropTypes.func.isRequired,
  onDelete:  PropTypes.func.isRequired,
  canEdit:   PropTypes.bool,
  canDelete: PropTypes.bool,
};

BookingDetail.defaultProps = {
  canEdit:   false,
  canDelete: false,
};

export default BookingDetail;
