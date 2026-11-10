import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Route, Switch } from 'react-router-dom';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  Accordion,
  AccordionSet,
  Button,
  FilterAccordionHeader,
  Icon,
  MultiColumnList,
  Pane,
  Paneset,
  SearchField,
} from '@folio/stripes/components';
import { CheckboxFilter } from '@folio/stripes/smart-components';
import { useOkapiKy, useStripes } from '@folio/stripes/core';

import ViewSwitcher from '../ViewSwitcher';
import EventDetail from './EventDetail';
import EventForm from './EventForm';
import { formatDateTimeDisplay } from '../../util/bookingUtils';

const COLUMNS = ['name', 'description', 'startDate', 'endDate'];
const WIDTHS = { name: '28%', description: '36%', startDate: '18%', endDate: '18%' };

const matchesTiming = (ev, timing, now) => {
  if (!timing.length) return true;
  const end = ev.endDate ? new Date(ev.endDate).getTime() : (ev.startDate ? new Date(ev.startDate).getTime() : null);
  const isPast = end !== null && end < now;
  return (timing.includes('past') && isPast) || (timing.includes('upcoming') && !isPast);
};

/**
 * Events view of the Bookings app. Same layout as the Bookings view (filter pane, results,
 * detail pane) and reached from the same Bookings / Events switch.
 */
const EventsApp = ({ match, history, onSwitchView }) => {
  const intl = useIntl();
  const ky = useOkapiKy();
  const stripes = useStripes();
  const canManage = stripes.hasPerm('ui-bookings.events.manage');
  const base = `${match.path}`; // .../bookings/events

  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [timing, setTiming] = useState([]);
  const [sort, setSort] = useState({ field: 'startDate', desc: true });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    ky.get('bookings/events', { searchParams: { limit: 1000 } }).json()
      .then((d) => { if (!cancelled) { setEvents(d.events || []); setIsLoading(false); } })
      .catch(() => { if (!cancelled) { setEvents([]); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const now = Date.now();
    const q = query.trim().toLowerCase();
    const rows = events.filter(ev => matchesTiming(ev, timing, now)
      && (!q || `${ev.name} ${ev.description || ''}`.toLowerCase().includes(q)));
    const val = (ev) => (ev[sort.field] || '');
    rows.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * (sort.desc ? -1 : 1));
    return rows;
  }, [events, query, timing, sort]);

  const selectedId = (history.location.pathname.replace(base, '').split('/').filter(Boolean)[0]);
  const selectedRow = visible.find(e => e.id === selectedId);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);
  const closeThirdPane = () => history.push(base);
  const reset = () => { setQueryInput(''); setQuery(''); setTiming([]); };

  const onSort = (_, meta) => {
    setSort(prev => (prev.field === meta.name ? { field: meta.name, desc: !prev.desc } : { field: meta.name, desc: false }));
  };

  const actionMenu = canManage ? ({ onToggle }) => (
    <Button
      id="clickable-new-event"
      buttonStyle="dropdownItem"
      onClick={() => { onToggle(); history.push(`${base}/create`); }}
    >
      <Icon icon="plus-sign"><FormattedMessage id="ui-bookings.event.new" /></Icon>
    </Button>
  ) : null;

  const timingOptions = [
    { value: 'upcoming', label: intl.formatMessage({ id: 'ui-bookings.event.filters.upcoming' }) },
    { value: 'past', label: intl.formatMessage({ id: 'ui-bookings.event.filters.past' }) },
  ];

  return (
    <Paneset>
      <Pane id="events-filter-pane" defaultWidth="22%" paneTitle={<FormattedMessage id="ui-bookings.filters.title" />}>
        <ViewSwitcher active="events" onChange={onSwitchView} />
        <form onSubmit={(e) => { e.preventDefault(); setQuery(queryInput); }}>
          <SearchField
            id="events-search-field"
            ariaLabel={intl.formatMessage({ id: 'ui-bookings.event.search' })}
            autoFocus
            onChange={(e) => setQueryInput(e.target.value)}
            onClear={() => { setQueryInput(''); setQuery(''); }}
            value={queryInput}
          />
          <Button type="submit" buttonStyle="primary" fullWidth disabled={!queryInput}>
            <FormattedMessage id="ui-bookings.action.search" />
          </Button>
          <Button buttonStyle="none" fullWidth onClick={reset}>
            <Icon icon="times-circle-solid"><FormattedMessage id="ui-bookings.action.resetAll" /></Icon>
          </Button>
        </form>
        <AccordionSet>
          <Accordion
            id="filter-event-timing"
            label={<FormattedMessage id="ui-bookings.event.filters.timing" />}
            header={FilterAccordionHeader}
            displayClearButton={timing.length > 0}
            onClearFilter={() => setTiming([])}
          >
            <CheckboxFilter
              name="timing"
              dataOptions={timingOptions}
              selectedValues={timing}
              onChange={({ values }) => setTiming(values)}
            />
          </Accordion>
        </AccordionSet>
      </Pane>

      <Pane
        id="events-results-pane"
        defaultWidth="fill"
        actionMenu={actionMenu}
        paneTitle={<FormattedMessage id="ui-bookings.meta.title" />}
        paneSub={isLoading
          ? <FormattedMessage id="ui-bookings.loading" />
          : <FormattedMessage id="ui-bookings.event.resultCount" values={{ count: visible.length }} />}
      >
        <MultiColumnList
          id="events-list"
          contentData={visible}
          selectedRow={selectedRow}
          visibleColumns={COLUMNS}
          columnWidths={WIDTHS}
          columnMapping={{
            name: <FormattedMessage id="ui-bookings.event.name" />,
            description: <FormattedMessage id="ui-bookings.event.description" />,
            startDate: <FormattedMessage id="ui-bookings.event.startDate" />,
            endDate: <FormattedMessage id="ui-bookings.event.endDate" />,
          }}
          formatter={{
            description: (ev) => ev.description || '—',
            startDate: (ev) => formatDateTimeDisplay(ev.startDate),
            endDate: (ev) => formatDateTimeDisplay(ev.endDate),
          }}
          sortOrder={sort.field}
          sortDirection={sort.desc ? 'descending' : 'ascending'}
          onHeaderClick={onSort}
          nonInteractiveHeaders={['description']}
          onRowClick={(_, row) => history.push(`${base}/${row.id}`)}
          isEmptyMessage={isLoading
            ? <FormattedMessage id="ui-bookings.loading" />
            : <FormattedMessage id="ui-bookings.event.noResults" />}
        />
      </Pane>

      <Switch>
        <Route
          path={`${base}/create`}
          render={() => (
            <EventForm
              onClose={closeThirdPane}
              onSaved={(ev) => { reload(); history.push(`${base}/${ev.id}`); }}
            />
          )}
        />
        <Route
          path={`${base}/:eventId/edit`}
          render={({ match: m }) => (
            <EventForm
              eventId={m.params.eventId}
              onClose={() => history.push(`${base}/${m.params.eventId}`)}
              onSaved={() => { reload(); history.push(`${base}/${m.params.eventId}`); }}
            />
          )}
        />
        <Route
          path={`${base}/:eventId`}
          render={({ match: m }) => (
            <EventDetail
              key={`${m.params.eventId}-${reloadKey}`}
              eventId={m.params.eventId}
              canEdit={canManage}
              onClose={closeThirdPane}
              onEdit={() => history.push(`${base}/${m.params.eventId}/edit`)}
              onDeleted={() => { reload(); closeThirdPane(); }}
            />
          )}
        />
      </Switch>
    </Paneset>
  );
};

EventsApp.propTypes = {
  match: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  onSwitchView: PropTypes.func.isRequired,
};

export default EventsApp;
