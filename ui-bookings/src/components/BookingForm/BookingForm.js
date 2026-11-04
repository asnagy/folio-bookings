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
  Col,
  Datepicker,
  FieldSet,
  Icon,
  KeyValue,
  Loading,
  MessageBanner,
  Pane,
  PaneFooter,
  PaneMenu,
  Pluggable,
  Row,
  TextArea,
  TextField,
  Timepicker,
} from '@folio/stripes/components';
import { useStripes } from '@folio/stripes/core';

import BookingItemsTable from '../BookingItemsTable';
import PatronLookup from './PatronLookup/PatronLookup';
import { validateRequired, validateDateOrder } from '../../util/validation';

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
    startTime: '',
    endDate: '',
    endTime: '',
    notes: '',
    items: [],
  });
  const [patron, setPatron]           = useState(null);
  const [isLoading, setIsLoading]     = useState(isEditing);
  const [submitError, setSubmitError] = useState(null);
  const [itemBarcode, setItemBarcode] = useState('');
  const [itemLookupError, setItemLookupError] = useState(null);
  const [checkedOutItems, setCheckedOutItems] = useState([]);

  const okapiHeaders = {
    'X-Okapi-Tenant': stripes.okapi.tenant,
    'X-Okapi-Token': stripes.store.getState().okapi.token,
    'Content-Type': 'application/json',
  };

  // ------------------------------------------------------------------
  // Load existing booking when editing
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!isEditing) return;
    setIsLoading(true);
    fetch(`${stripes.okapi.url}/bookings/bookings/${bookingId}`, { headers: okapiHeaders })
      .then(r => r.json())
      .then(data => {
        setInitialValues({
          userId: data.userId || '',
          startDate: data.startDate ? data.startDate.split('T')[0] : '',
          startTime: data.startDate ? data.startDate.split('T')[1]?.slice(0, 5) : '',
          endDate: data.endDate ? data.endDate.split('T')[0] : '',
          endTime: data.endDate ? data.endDate.split('T')[1]?.slice(0, 5) : '',
          notes: data.notes || '',
          items: data.items || [],
        });
        if (data.patron) setPatron(data.patron);
        const checkedOut = (data.items || []).filter(i => i.itemStatus === 'Checked out');
        setCheckedOutItems(checkedOut);
        setIsLoading(false);
      })
      .catch(err => {
        setSubmitError(err.message);
        setIsLoading(false);
      });
  }, [bookingId]);

  // ------------------------------------------------------------------
  // Patron selection (from Pluggable find-user)
  // ------------------------------------------------------------------

  const onSelectPatron = useCallback((selectedUser) => {
    setPatron(selectedUser);
  }, []);

  // ------------------------------------------------------------------
  // Item barcode lookup
  // ------------------------------------------------------------------

  const lookupItemByBarcode = useCallback(async (barcode, currentItems, form) => {
    setItemLookupError(null);
    if (!barcode?.trim()) return;
    if (currentItems.some(i => i.itemBarcode === barcode.trim())) {
      setItemLookupError(intl.formatMessage({ id: 'ui-bookings.error.itemAlreadyAdded' }));
      return;
    }
    try {
      const res = await fetch(
        `${stripes.okapi.url}/inventory/items?query=barcode=="${barcode.trim()}"`,
        { headers: okapiHeaders }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.items || data.items.length === 0) {
        setItemLookupError(intl.formatMessage(
          { id: 'ui-bookings.error.itemNotFound' }, { barcode }
        ));
        return;
      }
      const item = data.items[0];
      const newItem = {
        itemId: item.id,
        itemBarcode: item.barcode,
        itemTitle: item.title,
        callNumber: item.callNumber,
        itemStatus: item.status?.name,
        instanceId: item.instanceId,
        holdingsRecordId: item.holdingsRecordId,
        recallStatus: item.status?.name === 'Checked out' ? 'REQUIRED' : 'NOT_REQUIRED',
      };
      form.mutators.push('items', newItem);
      setItemBarcode('');
      if (item.status?.name === 'Checked out') {
        setCheckedOutItems(prev => [...prev, newItem]);
      }
    } catch (err) {
      setItemLookupError(err.message);
    }
  }, [intl, okapiHeaders]);

  // ------------------------------------------------------------------
  // Instance plugin callback — user selected an instance, now pick item
  // ------------------------------------------------------------------

  const onSelectInstance = useCallback(async (instance, currentItems, form) => {
    setItemLookupError(null);
    if (!instance?.id) return;
    try {
      // Fetch items for this instance
      const res = await fetch(
        `${stripes.okapi.url}/inventory/items?query=holdingsRecord.instanceId=="${instance.id}"&limit=200`,
        { headers: okapiHeaders }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = data.items || [];

      if (items.length === 0) {
        setItemLookupError(intl.formatMessage({ id: 'ui-bookings.error.noItemsForInstance' }));
        return;
      }

      // If there's only one item, add it directly
      if (items.length === 1) {
        const item = items[0];
        if (!currentItems.some(i => i.itemId === item.id)) {
          const newItem = {
            itemId: item.id,
            itemBarcode: item.barcode,
            itemTitle: instance.title,
            callNumber: item.effectiveCallNumberComponents?.callNumber || '',
            itemStatus: item.status?.name,
            instanceId: instance.id,
            holdingsRecordId: item.holdingsRecordId,
            recallStatus: item.status?.name === 'Checked out' ? 'REQUIRED' : 'NOT_REQUIRED',
          };
          form.mutators.push('items', newItem);
          if (item.status?.name === 'Checked out') {
            setCheckedOutItems(prev => [...prev, newItem]);
          }
        }
        return;
      }

      // Multiple items — add all (UI will show them for review)
      items.forEach(item => {
        if (!currentItems.some(i => i.itemId === item.id)) {
          const newItem = {
            itemId: item.id,
            itemBarcode: item.barcode,
            itemTitle: instance.title,
            callNumber: item.effectiveCallNumberComponents?.callNumber || '',
            itemStatus: item.status?.name,
            instanceId: instance.id,
            holdingsRecordId: item.holdingsRecordId,
            recallStatus: item.status?.name === 'Checked out' ? 'REQUIRED' : 'NOT_REQUIRED',
          };
          form.mutators.push('items', newItem);
          if (item.status?.name === 'Checked out') {
            setCheckedOutItems(prev => [...prev, newItem]);
          }
        }
      });
    } catch (err) {
      setItemLookupError(err.message);
    }
  }, [intl, okapiHeaders]);

  // ------------------------------------------------------------------
  // Form submission
  // ------------------------------------------------------------------

  const onSubmit = useCallback(async (values) => {
    setSubmitError(null);
    const startDateTime = `${values.startDate}T${values.startTime || '00:00'}:00Z`;
    const endDateTime   = `${values.endDate}T${values.endTime || '00:00'}:00Z`;

    const payload = {
      userId: patron?.id || values.userId,
      startDate: startDateTime,
      endDate: endDateTime,
      notes: values.notes || undefined,
      itemIds: (values.items || []).map(i => i.itemId),
    };

    try {
      const url = isEditing
        ? `${stripes.okapi.url}/bookings/bookings/${bookingId}`
        : `${stripes.okapi.url}/bookings/bookings`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: okapiHeaders,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.errors?.[0]?.message || `HTTP ${res.status}`);
      }

      const saved = method === 'POST' ? await res.json() : { id: bookingId };
      onSubmitSuccess(saved);
    } catch (err) {
      setSubmitError(err.message);
    }
  }, [patron, isEditing, bookingId, onSubmitSuccess, okapiHeaders]);

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
      const start = new Date(`${values.startDate}T${values.startTime || '00:00'}`);
      const end   = new Date(`${values.endDate}T${values.endTime || '00:00'}`);
      if (start >= end) {
        errors.endDate = intl.formatMessage({ id: 'ui-bookings.validation.endAfterStart' });
      }
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
                  stripes={stripes}
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
                      component={Datepicker}
                      required
                    />
                  </Col>
                  <Col xs={6}>
                    <Field
                      name="startTime"
                      label={<FormattedMessage id="ui-bookings.booking.startTime" />}
                      component={Timepicker}
                    />
                  </Col>
                </Row>
                <Row>
                  <Col xs={6}>
                    <Field
                      name="endDate"
                      label={<FormattedMessage id="ui-bookings.booking.endDate" />}
                      component={Datepicker}
                      required
                    />
                  </Col>
                  <Col xs={6}>
                    <Field
                      name="endTime"
                      label={<FormattedMessage id="ui-bookings.booking.endTime" />}
                      component={Timepicker}
                    />
                  </Col>
                </Row>
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
                  <Col xs={8}>
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
                  <Col xs={4} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '1rem' }}>
                    {/*
                     * Instance lookup plugin — matches the "Title look-up" pattern
                     * from ui-requests. Uses ui-plugin-find-instance which provides
                     * a full Inventory search modal.
                     */}
                    <Pluggable
                      type="find-instance"
                      id="clickable-find-instance"
                      searchLabel={<FormattedMessage id="ui-bookings.item.lookUp" />}
                      selectInstance={(instance) => onSelectInstance(instance, values.items || [], form)}
                      dataKey="instances"
                    >
                      <Button id="clickable-find-instance-fallback">
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
