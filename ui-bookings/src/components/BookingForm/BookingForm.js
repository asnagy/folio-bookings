import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, useIntl } from 'react-intl';
import { Form, Field } from 'react-final-form';
import arrayMutators from 'final-form-arrays';
import { FieldArray } from 'react-final-form-arrays';
import {
  Accordion,
  AccordionSet,
  Button,
  Checkbox,
  Col,
  Icon,
  KeyValue,
  Loading,
  MessageBanner,
  Pane,
  PaneFooter,
  PaneMenu,
  Row,
  Select,
  TextArea,
  TextField,
} from '@folio/stripes/components';
import { Pluggable, useOkapiKy } from '@folio/stripes/core';

import BookingItemsTable from '../BookingItemsTable';
import PatronLookup from './PatronLookup/PatronLookup';
import ItemSelectModal from './ItemSelectModal/ItemSelectModal';
import PickupByLookup from './PickupByLookup/PickupByLookup';

const userSummary = (u) => (u ? { id: u.id, barcode: u.barcode, firstName: u.personal?.firstName ?? u.firstName, lastName: u.personal?.lastName ?? u.lastName } : null);

const pad = (n) => String(n).padStart(2, '0');

// ISO instant -> value for <input type="datetime-local"> (local time)
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// datetime-local value -> ISO instant (UTC)
const toIso = (local) => (local ? new Date(local).toISOString() : undefined);

// Normalise a patron from either the find-user plugin (user record) or the booking API
const normalisePatron = (p) => {
  if (!p) return null;
  return {
    id: p.id,
    barcode: p.barcode,
    firstName: p.personal?.firstName ?? p.firstName,
    lastName: p.personal?.lastName ?? p.lastName,
    patronGroup: p.patronGroup,
  };
};

/**
 * BookingForm
 *
 * Create / edit form for a booking record. Handles:
 *
 *  Patron selection  — text field that accepts a patron barcode/name,
 *                      backed by a <Pluggable type="find-user"> modal.
 *
 *  Item selection    — two mechanisms (matching the Requests app pattern):
 *    1. Barcode entry field — type or scan an item barcode, press Enter
 *    2. "Look up item" button — opens a <Pluggable type="find-instance">
 *       modal for title/instance search, then narrows to a specific item.
 *
 *  Date/time range   — start and end date + time pickers.
 *
 *  Notes             — free-text staff notes field.
 *
 *  Recall banner     — when any added item is currently "Checked out",
 *                      a prominent warning banner is shown explaining that
 *                      a recall will be triggered automatically on save.
 */
const BookingForm = (props) => {
  const {
    bookingId,
    onClose,
    onSubmitSuccess,
    stripes,
  } = props;

  const intl = useIntl();
  const isEditing = Boolean(bookingId);

  const [initialValues, setInitialValues] = useState({
    userId: '',
    startDate: '',
    endDate: '',
    delivered: false,
    deliveryLocation: '',
    pickupServicePointId: '',
    eventId: '',
    overrideAvailability: false,
    notes: '',
    items: [],
  });
  const [servicePoints, setServicePoints] = useState([]);
  const [events, setEvents] = useState([]);
  const [pickupBy, setPickupBy] = useState(null);
  const canOverride = stripes.hasPerm('ui-bookings.override-availability');
  const [patron, setPatron]           = useState(null);
  const [isLoading, setIsLoading]     = useState(isEditing);
  const [submitError, setSubmitError] = useState(null);
  const [itemBarcode, setItemBarcode] = useState('');
  const [itemLookupError, setItemLookupError] = useState(null);
  const [checkedOutItems, setCheckedOutItems] = useState([]);
  const [itemAddedMessage, setItemAddedMessage] = useState(null);
  const [picker, setPicker] = useState(null); // { instance, items } while the item picker is open

  const ky = useOkapiKy();

  // ------------------------------------------------------------------
  // Load existing booking when editing
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!isEditing) return;
    setIsLoading(true);
    ky.get(`bookings/bookings/${bookingId}`).json()
      .then(data => {
        setInitialValues({
          userId: data.userId || '',
          startDate: toLocalInput(data.startDate),
          endDate: toLocalInput(data.endDate),
          delivered: Boolean(data.delivered),
          deliveryLocation: data.deliveryLocation || '',
          pickupServicePointId: data.pickupServicePointId || '',
          eventId: data.eventId || '',
          overrideAvailability: false,
          notes: data.notes || '',
          items: data.items || [],
        });
        if (data.pickupByUserId) {
          ky.get(`users/${data.pickupByUserId}`).json()
            .then(u => setPickupBy(userSummary(u)))
            .catch(() => setPickupBy({ id: data.pickupByUserId }));
        }
        setPatron(normalisePatron(data.patron) || (data.userId ? { id: data.userId } : null));
        const checkedOut = (data.items || []).filter(i => i.itemStatus === 'Checked out');
        setCheckedOutItems(checkedOut);
        setIsLoading(false);
      })
      .catch(err => {
        setSubmitError(err.message);
        setIsLoading(false);
      });
  }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    ky.get('service-points', { searchParams: { query: 'pickupLocation==true sortby name', limit: 200 } }).json()
      .then(data => setServicePoints(data.servicepoints || []))
      .catch(() => setServicePoints([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    ky.get('bookings/events', { searchParams: { limit: 500 } }).json()
      .then(data => setEvents(data.events || []))
      .catch(() => setEvents([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Patron selection (from Pluggable find-user)
  // ------------------------------------------------------------------

  const onSelectPatron = useCallback((selectedUser) => {
    setPatron(normalisePatron(selectedUser));
  }, []);

  // ------------------------------------------------------------------
  // Items: barcode scan and title look-up both end in addItems()
  // ------------------------------------------------------------------

  // Inventory item record -> the shape stored in the form (one entry per item record)
  const toBookingItem = (item, instanceTitle) => ({
    itemId: item.id,
    itemBarcode: item.barcode,
    itemTitle: instanceTitle || item.title || '',
    callNumber: item.effectiveCallNumberComponents?.callNumber || item.callNumber || '',
    itemStatus: item.status?.name,
    instanceId: item.instanceId,
    holdingsRecordId: item.holdingsRecordId,
    recallStatus: item.status?.name === 'Checked out' ? 'REQUIRED' : 'NOT_REQUIRED',
  });

  // Adds item records to the booking (skipping any already there) and flags items on loan
  const addItems = (inventoryItems, instanceTitle, currentItems, form) => {
    const existing = new Set(currentItems.map(i => i.itemId));
    const added = [];
    inventoryItems.forEach((inv) => {
      if (existing.has(inv.id)) return;
      const bookingItem = toBookingItem(inv, instanceTitle);
      form.mutators.push('items', bookingItem);
      existing.add(inv.id);
      added.push(bookingItem);
    });
    const onLoan = added.filter(i => i.itemStatus === 'Checked out');
    if (onLoan.length) setCheckedOutItems(prev => [...prev, ...onLoan]);
    return added;
  };

  const lookupItemByBarcode = async (barcode, currentItems, form) => {
    setItemLookupError(null);
    setItemAddedMessage(null);
    const trimmed = barcode?.trim();
    if (!trimmed) return;
    if (currentItems.some(i => i.itemBarcode === trimmed)) {
      setItemLookupError(intl.formatMessage({ id: 'ui-bookings.error.itemAlreadyAdded' }));
      return;
    }
    try {
      const data = await ky.get('inventory/items', {
        searchParams: { query: `barcode=="${trimmed}"`, limit: 1 },
      }).json();
      if (!data.items || data.items.length === 0) {
        setItemLookupError(intl.formatMessage({ id: 'ui-bookings.error.itemNotFound' }, { barcode: trimmed }));
        return;
      }
      const [added] = addItems([data.items[0]], null, currentItems, form);
      setItemBarcode('');
      if (added) {
        setItemAddedMessage(intl.formatMessage(
          { id: 'ui-bookings.item.added' },
          { title: added.itemTitle || added.itemBarcode, barcode: added.itemBarcode },
        ));
      }
    } catch (err) {
      setItemLookupError(err.message);
    }
  };

  // Title look-up: the plugin returns an instance; load its item records and let staff pick
  const onSelectInstance = async (instance) => {
    setItemLookupError(null);
    setItemAddedMessage(null);
    if (!instance?.id) return;
    try {
      const holdings = await ky.get('holdings-storage/holdings', {
        searchParams: { query: `instanceId=="${instance.id}"`, limit: 1000 },
      }).json();
      const holdingIds = (holdings.holdingsRecords || []).map(h => h.id);
      const found = [];
      for (let i = 0; i < holdingIds.length; i += 25) {
        const chunk = holdingIds.slice(i, i + 25);
        const data = await ky.get('inventory/items', {
          searchParams: {
            query: `holdingsRecordId==(${chunk.map(id => `"${id}"`).join(' or ')})`,
            limit: 1000,
          },
        }).json();
        found.push(...(data.items || []));
      }
      if (found.length === 0) {
        setItemLookupError(intl.formatMessage({ id: 'ui-bookings.error.noItemsForInstance' }));
        return;
      }
      setPicker({ instance, items: found });
    } catch (err) {
      setItemLookupError(err.message);
    }
  };

  // ------------------------------------------------------------------
  // Form submission
  // ------------------------------------------------------------------

  const onSubmit = useCallback(async (values) => {
    setSubmitError(null);
    const startDateTime = toIso(values.startDate);
    const endDateTime   = toIso(values.endDate);

    const payload = {
      userId: patron?.id || values.userId,
      startDate: startDateTime,
      endDate: endDateTime,
      delivered: Boolean(values.delivered),
      deliveryLocation: values.delivered ? (values.deliveryLocation || '').trim() : undefined,
      pickupServicePointId: values.delivered ? undefined : (values.pickupServicePointId || undefined),
      pickupByUserId: pickupBy?.id || undefined,
      eventId: values.eventId || undefined,
      overrideAvailability: canOverride ? Boolean(values.overrideAvailability) : undefined,
      notes: values.notes || undefined,
      itemIds: (values.items || []).map(i => i.itemId),
    };

    try {
      const saved = isEditing
        ? await ky.put(`bookings/bookings/${bookingId}`, { json: payload }).then(() => ({ id: bookingId }))
        : await ky.post('bookings/bookings', { json: payload }).json();
      onSubmitSuccess(saved);
    } catch (err) {
      let message = err.message;
      try {
        const body = await err.response?.json();
        message = body?.errors?.[0]?.message || message;
      } catch (e) { /* keep default message */ }
      setSubmitError(message);
    }
  }, [patron, pickupBy, isEditing, bookingId, onSubmitSuccess, ky, canOverride]);

  // ------------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------------

  const validate = (values) => {
    const errors = {};
    if (!patron && !values.userId) {
      errors.userId = intl.formatMessage({ id: 'ui-bookings.validation.patronRequired' });
    }
    if (!values.startDate) {
      errors.startDate = intl.formatMessage({ id: 'ui-bookings.validation.required' });
    }
    if (!values.endDate) {
      errors.endDate = intl.formatMessage({ id: 'ui-bookings.validation.required' });
    }
    if (values.startDate && values.endDate) {
      const start = new Date(values.startDate);
      const end   = new Date(values.endDate);
      if (start >= end) {
        errors.endDate = intl.formatMessage({ id: 'ui-bookings.validation.endAfterStart' });
      }
    }
    if (values.delivered) {
      if (!values.deliveryLocation || !values.deliveryLocation.trim()) {
        errors.deliveryLocation = intl.formatMessage({ id: 'ui-bookings.validation.required' });
      }
    } else if (!values.pickupServicePointId) {
      errors.pickupServicePointId = intl.formatMessage({ id: 'ui-bookings.validation.required' });
    }
    if (!values.items || values.items.length === 0) {
      errors.items = intl.formatMessage({ id: 'ui-bookings.validation.itemsRequired' });
    }
    return errors;
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (isLoading) {
    return (
      <Pane
        id="booking-form-pane"
        defaultWidth="44%"
        paneTitle={<FormattedMessage id="ui-bookings.booking.loading" />}
      >
        <Loading size="xlarge" />
      </Pane>
    );
  }

  return (
    <Form
      initialValues={initialValues}
      onSubmit={onSubmit}
      validate={validate}
      mutators={{ ...arrayMutators }}
      render={({ handleSubmit, submitting, pristine, invalid, form, values }) => (
        <Pane
          id="booking-form-pane"
          defaultWidth="44%"
          firstMenu={
            <PaneMenu>
              <Button
                buttonStyle="none"
                id="clickable-close-booking-form"
                onClick={onClose}
                aria-label={intl.formatMessage({ id: 'ui-bookings.action.close' })}
              >
                <Icon icon="times" />
              </Button>
            </PaneMenu>
          }
          paneTitle={
            isEditing
              ? <FormattedMessage id="ui-bookings.booking.editTitle" />
              : <FormattedMessage id="ui-bookings.booking.newTitle" />
          }
          footer={
            <PaneFooter
              renderStart={
                <Button
                  buttonStyle="default mega"
                  id="clickable-cancel-booking-form"
                  onClick={onClose}
                >
                  <FormattedMessage id="ui-bookings.action.cancel" />
                </Button>
              }
              renderEnd={
                <Button
                  buttonStyle="primary mega"
                  id="clickable-save-booking"
                  type="submit"
                  onClick={handleSubmit}
                  disabled={submitting || pristine || invalid}
                >
                  <FormattedMessage id="ui-bookings.action.save" />
                </Button>
              }
            />
          }
        >
          {submitError && (
            <MessageBanner type="error" onExited={() => setSubmitError(null)}>
              {submitError}
            </MessageBanner>
          )}

          {checkedOutItems.length > 0 && (
            <MessageBanner type="warning">
              <FormattedMessage
                id="ui-bookings.warning.recallRequired"
                values={{ count: checkedOutItems.length }}
              />
            </MessageBanner>
          )}

          <form onSubmit={handleSubmit}>
            <AccordionSet>

              {/* ---- Patron ---- */}
              <Accordion
                id="patronSection"
                label={<FormattedMessage id="ui-bookings.accordion.patron" />}
              >
                <PatronLookup
                  patron={patron}
                  onSelectPatron={onSelectPatron}
                />
              </Accordion>

              {/* ---- Booking Dates ---- */}
              <Accordion
                id="datesSection"
                label={<FormattedMessage id="ui-bookings.accordion.dates" />}
              >
                <Row>
                  <Col xs={6}>
                    <Field
                      name="startDate"
                      label={<FormattedMessage id="ui-bookings.booking.startDate" />}
                      component={TextField}
                      type="datetime-local"
                      required
                    />
                  </Col>
                  <Col xs={6}>
                    <Field
                      name="endDate"
                      label={<FormattedMessage id="ui-bookings.booking.endDate" />}
                      component={TextField}
                      type="datetime-local"
                      required
                    />
                  </Col>
                </Row>
                <Row>
                  <Col xs={12}>
                    <Field
                      name="delivered"
                      type="checkbox"
                      label={<FormattedMessage id="ui-bookings.booking.delivered" />}
                      component={Checkbox}
                    />
                  </Col>
                </Row>
                <Row>
                  <Col xs={12}>
                    {values.delivered ? (
                      <Field
                        name="deliveryLocation"
                        label={<FormattedMessage id="ui-bookings.booking.deliveryLocation" />}
                        component={TextField}
                        maxLength={500}
                        required
                      />
                    ) : (
                      <Field
                        name="pickupServicePointId"
                        label={<FormattedMessage id="ui-bookings.booking.pickupServicePoint" />}
                        component={Select}
                        required
                        dataOptions={[
                          { value: '', label: intl.formatMessage({ id: 'ui-bookings.booking.selectServicePoint' }) },
                          ...servicePoints.map(sp => ({ value: sp.id, label: sp.name })),
                        ]}
                      />
                    )}
                  </Col>
                </Row>
                <Row>
                  <Col xs={12}>
                    <PickupByLookup user={pickupBy} onSelectUser={(u) => setPickupBy(userSummary(u))} />
                  </Col>
                </Row>
                <Row>
                  <Col xs={12}>
                    <Field
                      name="eventId"
                      label={<FormattedMessage id="ui-bookings.booking.event" />}
                      component={Select}
                      dataOptions={[
                        { value: '', label: intl.formatMessage({ id: 'ui-bookings.booking.selectEvent' }) },
                        ...events.map(ev => ({ value: ev.id, label: ev.name })),
                      ]}
                    />
                  </Col>
                </Row>
                {canOverride && (
                  <Row>
                    <Col xs={12}>
                      <Field
                        name="overrideAvailability"
                        type="checkbox"
                        label={<FormattedMessage id="ui-bookings.booking.overrideAvailability" />}
                        component={Checkbox}
                      />
                    </Col>
                  </Row>
                )}
              </Accordion>

              {/* ---- Items ---- */}
              <Accordion
                id="itemsSection"
                label={
                  <FormattedMessage
                    id="ui-bookings.accordion.items"
                    values={{ count: values.items?.length || 0 }}
                  />
                }
              >
                {/* Barcode entry row */}
                <Row>
                  <Col xs={12}>
                    <TextField
                      id="item-barcode-field"
                      label={<FormattedMessage id="ui-bookings.item.barcodeEntry" />}
                      value={itemBarcode}
                      onChange={e => setItemBarcode(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          lookupItemByBarcode(itemBarcode, values.items || [], form);
                        }
                      }}
                      endControl={
                        <Button
                          buttonStyle="none"
                          id="clickable-add-item-by-barcode"
                          marginBottom0
                          onClick={() => lookupItemByBarcode(itemBarcode, values.items || [], form)}
                          aria-label={intl.formatMessage({ id: 'ui-bookings.item.add' })}
                        >
                          <Icon icon="search" />
                        </Button>
                      }
                    />
                  </Col>
                </Row>
                <Row>
                  <Col xs={12}>
                    {/*
                     * Instance lookup plugin — the "Title look-up" pattern from ui-requests,
                     * rendered as a link under the barcode field.
                     */}
                    <Pluggable
                      aria-haspopup="true"
                      type="find-instance"
                      id="clickable-find-instance"
                      searchLabel={<FormattedMessage id="ui-bookings.item.lookUp" />}
                      searchButtonStyle="link"
                      marginTop0
                      selectInstance={onSelectInstance}
                      dataKey="instances"
                    >
                      <Button buttonStyle="link" id="clickable-find-instance-fallback">
                        <FormattedMessage id="ui-bookings.item.lookUp" />
                      </Button>
                    </Pluggable>
                  </Col>
                </Row>

                {itemLookupError && (
                  <MessageBanner type="error" onExited={() => setItemLookupError(null)}>
                    {itemLookupError}
                  </MessageBanner>
                )}

                {itemAddedMessage && (
                  <MessageBanner type="success" onExited={() => setItemAddedMessage(null)}>
                    {itemAddedMessage}
                  </MessageBanner>
                )}

                <ItemSelectModal
                  open={Boolean(picker)}
                  instance={picker?.instance}
                  items={picker?.items || []}
                  existingItemIds={(values.items || []).map(i => i.itemId)}
                  onClose={() => setPicker(null)}
                  onAdd={(selectedItems) => {
                    const added = addItems(selectedItems, picker?.instance?.title, values.items || [], form);
                    setPicker(null);
                    if (added.length) {
                      setItemAddedMessage(intl.formatMessage(
                        { id: 'ui-bookings.item.added' },
                        { title: added[0].itemTitle, barcode: added.map(a => a.itemBarcode).join(', ') },
                      ));
                    }
                  }}
                />

                {/* Items table */}
                <FieldArray name="items">
                  {({ fields }) => (
                    <BookingItemsTable
                      items={fields.value || []}
                      onRemove={(index) => fields.remove(index)}
                      readOnly={false}
                    />
                  )}
                </FieldArray>
              </Accordion>

              {/* ---- Notes ---- */}
              <Accordion
                id="notesSection"
                label={<FormattedMessage id="ui-bookings.accordion.notes" />}
              >
                <Field
                  name="notes"
                  label={<FormattedMessage id="ui-bookings.booking.notes" />}
                  component={TextArea}
                  rows={4}
                  maxLength={2000}
                />
              </Accordion>

            </AccordionSet>
          </form>
        </Pane>
      )}
    />
  );
};

BookingForm.propTypes = {
  bookingId:       PropTypes.string,
  onClose:         PropTypes.func.isRequired,
  onSubmitSuccess: PropTypes.func.isRequired,
  stripes:         PropTypes.object.isRequired,
};

BookingForm.defaultProps = {
  bookingId: null,
};

export default BookingForm;
