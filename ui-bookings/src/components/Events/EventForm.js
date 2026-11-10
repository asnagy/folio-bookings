import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, useIntl } from 'react-intl';
import { Form, Field } from 'react-final-form';
import {
  Button,
  Col,
  Icon,
  Loading,
  MessageBanner,
  Pane,
  PaneFooter,
  PaneMenu,
  Row,
  TextArea,
  TextField,
} from '@folio/stripes/components';
import { useOkapiKy } from '@folio/stripes/core';

import { toIso, toLocalInput } from '../../util/dateInputs';

/** Create / edit form for an event. Events are optional: bookings never require one. */
const EventForm = ({ eventId, onClose, onSaved }) => {
  const intl = useIntl();
  const ky = useOkapiKy();
  const isEditing = Boolean(eventId);
  const [initialValues, setInitialValues] = useState({ name: '', description: '', startDate: '', endDate: '' });
  const [isLoading, setIsLoading] = useState(isEditing);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!isEditing) return;
    setIsLoading(true);
    ky.get(`bookings/events/${eventId}`).json()
      .then((ev) => {
        setInitialValues({
          name: ev.name || '',
          description: ev.description || '',
          startDate: toLocalInput(ev.startDate),
          endDate: toLocalInput(ev.endDate),
        });
        setIsLoading(false);
      })
      .catch((err) => { setSubmitError(err.message); setIsLoading(false); });
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (values) => {
    setSubmitError(null);
    const payload = {
      name: values.name.trim(),
      description: values.description || undefined,
      startDate: toIso(values.startDate),
      endDate: toIso(values.endDate),
    };
    try {
      if (isEditing) {
        await ky.put(`bookings/events/${eventId}`, { json: payload });
        onSaved({ id: eventId });
      } else {
        onSaved(await ky.post('bookings/events', { json: payload }).json());
      }
    } catch (err) {
      let message = err.message;
      try {
        const body = await err.response?.json();
        message = body?.errors?.[0]?.message || message;
      } catch (e) { /* keep default */ }
      setSubmitError(message);
    }
  };

  const validate = (values) => {
    const errors = {};
    const required = intl.formatMessage({ id: 'ui-bookings.validation.required' });
    if (!values.name || !values.name.trim()) errors.name = required;
    if (values.startDate && values.endDate && new Date(values.endDate) < new Date(values.startDate)) {
      errors.endDate = intl.formatMessage({ id: 'ui-bookings.validation.endAfterStart' });
    }
    return errors;
  };

  if (isLoading) {
    return (
      <Pane id="event-form-pane" defaultWidth="44%" paneTitle={<FormattedMessage id="ui-bookings.booking.loading" />}>
        <Loading size="xlarge" />
      </Pane>
    );
  }

  return (
    <Form
      initialValues={initialValues}
      onSubmit={onSubmit}
      validate={validate}
      render={({ handleSubmit, submitting, pristine, invalid }) => (
        <Pane
          id="event-form-pane"
          defaultWidth="44%"
          firstMenu={(
            <PaneMenu>
              <Button
                buttonStyle="none"
                id="clickable-close-event-form"
                onClick={onClose}
                aria-label={intl.formatMessage({ id: 'ui-bookings.action.close' })}
              >
                <Icon icon="times" />
              </Button>
            </PaneMenu>
          )}
          paneTitle={<FormattedMessage id={isEditing ? 'ui-bookings.event.editTitle' : 'ui-bookings.event.newTitle'} />}
          footer={(
            <PaneFooter
              renderStart={(
                <Button buttonStyle="default mega" id="clickable-cancel-event-form" onClick={onClose}>
                  <FormattedMessage id="ui-bookings.action.cancel" />
                </Button>
              )}
              renderEnd={(
                <Button
                  buttonStyle="primary mega"
                  id="clickable-save-event"
                  type="submit"
                  onClick={handleSubmit}
                  disabled={submitting || pristine || invalid}
                >
                  <FormattedMessage id="ui-bookings.action.save" />
                </Button>
              )}
            />
          )}
        >
          {submitError && (
            <MessageBanner type="error" onExited={() => setSubmitError(null)}>{submitError}</MessageBanner>
          )}
          <form onSubmit={handleSubmit}>
            <Row>
              <Col xs={12}>
                <Field
                  name="name"
                  label={<FormattedMessage id="ui-bookings.event.name" />}
                  component={TextField}
                  maxLength={255}
                  required
                  autoFocus
                />
              </Col>
            </Row>
            <Row>
              <Col xs={12}>
                <Field
                  name="description"
                  label={<FormattedMessage id="ui-bookings.event.description" />}
                  component={TextArea}
                  rows={4}
                  maxLength={2000}
                />
              </Col>
            </Row>
            <Row>
              <Col xs={6}>
                <Field
                  name="startDate"
                  label={<FormattedMessage id="ui-bookings.event.startDate" />}
                  component={TextField}
                  type="datetime-local"
                />
              </Col>
              <Col xs={6}>
                <Field
                  name="endDate"
                  label={<FormattedMessage id="ui-bookings.event.endDate" />}
                  component={TextField}
                  type="datetime-local"
                />
              </Col>
            </Row>
          </form>
        </Pane>
      )}
    />
  );
};

EventForm.propTypes = {
  eventId: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

EventForm.defaultProps = { eventId: null };

export default EventForm;
