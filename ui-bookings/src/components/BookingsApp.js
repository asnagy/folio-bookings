import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Route, Switch } from 'react-router-dom';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  MultiColumnList,
  Pane,
  PaneMenu,
  Paneset,
  SearchField,
  Accordion,
  AccordionSet,
  Button,
  FilterAccordionHeader,
  Icon,
  MessageBanner,
} from '@folio/stripes/components';
import { CheckboxFilter, SearchAndSortQuery } from '@folio/stripes/smart-components';
import { stripesConnect, useOkapiKy, useStripes } from '@folio/stripes/core';

import BookingDetail from './BookingDetail/BookingDetail';
import BookingForm from './BookingForm/BookingForm';
import ViewSwitcher from './ViewSwitcher';
import { BOOKINGS_RESOURCE, BOOKING_STATUSES } from '../manifest';
import BookingRecallBadge from './BookingStatus/BookingRecallBadge';
import BookingStatusBadge from './BookingStatus/BookingStatusBadge';
import { formatDateTimeDisplay } from '../util/bookingUtils';
import { csvFilename, downloadCsv, toCsv } from '../util/csv';

import css from './BookingsApp.css';

const COLUMN_WIDTHS = {
  patronName:  '16%',
  items:       '24%',
  startDate:   '13%',
  endDate:     '13%',
  servicePoint: '14%',
  status:      '12%',
  recall:      '8%',
};

const COLUMN_LABEL_IDS = {
  patronName: 'ui-bookings.booking.patron',
  items: 'ui-bookings.booking.itemCount',
  servicePoint: 'ui-bookings.booking.pickupServicePoint',
  startDate: 'ui-bookings.booking.startDate',
  endDate: 'ui-bookings.booking.endDate',
  status: 'ui-bookings.booking.status',
  recall: 'ui-bookings.booking.recall',
};

const COLUMN_NAMES = ['patronName', 'items', 'servicePoint', 'startDate', 'endDate', 'status', 'recall'];

/**
 * BookingsApp
 *
 * Root component for the Bookings app. Renders a three-pane layout:
 *   Pane 1 — Search & filter sidebar
 *   Pane 2 — Results MCL (MultiColumnList)
 *   Pane 3 — Detail/edit panel (mounted via React Router)
 *
 * Follows the same pattern as ui-users and ui-requests.
 */
const BookingsApp = (props) => {
  const { resources, mutator, match, history, location } = props;
  const stripes = useStripes();
  const intl = useIntl();
  const ky = useOkapiKy();

  // Service point names, so the list can show a name instead of an id
  const [servicePointNames, setServicePointNames] = useState({});
  useEffect(() => {
    ky.get('service-points', { searchParams: { query: 'cql.allRecords=1', limit: 1000 } }).json()
      .then(data => setServicePointNames(
        Object.fromEntries((data.servicepoints || []).map(sp => [sp.id, sp.name])),
      ))
      .catch(() => setServicePointNames({}));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const canCreate = stripes.hasPerm('ui-bookings.create-edit');
  const canDelete = stripes.hasPerm('ui-bookings.delete');

  const bookings = resources.bookings?.records || [];
  const totalRecords = resources.bookings?.other?.totalRecords || 0;
  const isLoading = resources.bookings?.isPending;

  // ------------------------------------------------------------------
  // Navigation helpers
  // ------------------------------------------------------------------

  const openDetail = useCallback((booking) => {
    setSelectedBookingId(booking.id);
    setIsCreating(false);
    history.push(`${match.path}/${booking.id}`);
  }, [history, match.path]);

  const openCreate = useCallback(() => {
    setSelectedBookingId(null);
    setIsCreating(true);
    history.push(`${match.path}/create`);
  }, [history, match.path]);

  const closeThirdPane = useCallback(() => {
    setSelectedBookingId(null);
    setIsCreating(false);
    history.push(match.path);
  }, [history, match.path]);

  // ------------------------------------------------------------------
  // MCL column formatters
  // ------------------------------------------------------------------

  const patronText = (row) => {
    const p = row.patron;
    if (!p) return row.userId || '—';
    return `${p.lastName || ''}, ${p.firstName || ''}`.trim().replace(/^,\s*/, '') || row.userId;
  };
  const itemTitles = (row) => (row.items || []).map(i => i.itemTitle || i.itemBarcode).filter(Boolean);
  // Delivered bookings show the free-text delivery location where pickup bookings show the service point
  const locationText = (row) => {
    if (row.delivered) return row.deliveryLocation || '—';
    return row.pickupServicePointId ? (servicePointNames[row.pickupServicePointId] || row.pickupServicePointId) : '—';
  };
  const recallText = (row) => {
    const items = row.items || [];
    if (!items.some(i => i.recallStatus === 'REQUIRED' || i.recallStatus === 'TRIGGERED')) return '—';
    const status = items.every(i => i.recallStatus !== 'REQUIRED') ? 'triggered' : 'required';
    return intl.formatMessage({ id: `ui-bookings.recallStatus.${status}` });
  };

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Exports every booking matching the current search and filters (not just the rows loaded so far)
  const exportCsv = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const cql = BOOKINGS_RESOURCE.GET.params.query(null, null, { query: resources.query || {} });
      const PAGE = 100;
      let all = [];
      let total = Infinity;
      while (all.length < total) {
        const page = await ky.get('bookings/bookings', {
          searchParams: { query: cql, limit: PAGE, offset: all.length },
        }).json();
        total = page.totalRecords ?? 0;
        if (!page.bookings?.length) break;
        all = all.concat(page.bookings);
      }
      const headers = COLUMN_NAMES.map(c => intl.formatMessage({ id: COLUMN_LABEL_IDS[c] }));
      const rows = all.map(row => [
        patronText(row),
        itemTitles(row).join('; ') || '—',
        locationText(row),
        formatDateTimeDisplay(row.startDate),
        formatDateTimeDisplay(row.endDate),
        row.status ? intl.formatMessage({ id: `ui-bookings.status.${row.status.toLowerCase()}` }) : '',
        recallText(row),
      ]);
      downloadCsv(csvFilename('bookings'), toCsv(headers, rows));
    } catch (err) {
      setExportError(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const columnFormatters = {
    patronName: patronText,
    startDate: (row) => formatDateTimeDisplay(row.startDate),
    endDate:   (row) => formatDateTimeDisplay(row.endDate),
    status:    (row) => <BookingStatusBadge status={row.status} />,
    recall:    (row) => {
      const n = (row.items || []).filter(i => i.recallStatus === 'REQUIRED' || i.recallStatus === 'TRIGGERED').length;
      if (!n) return '—';
      const triggered = (row.items || []).every(i => i.recallStatus !== 'REQUIRED');
      return <BookingRecallBadge status={triggered ? 'TRIGGERED' : 'REQUIRED'} />;
    },
    items:     (row) => {
      const titles = itemTitles(row);
      if (!titles.length) return '—';
      return (
        <ul className={css.itemTitles}>
          {titles.map((title, index) => <li key={`${title}-${index}`}>{title}</li>)}
        </ul>
      );
    },
    servicePoint: locationText,
  };

  const columnMapping = {
    patronName: <FormattedMessage id="ui-bookings.booking.patron" />,
    startDate:  <FormattedMessage id="ui-bookings.booking.startDate" />,
    endDate:    <FormattedMessage id="ui-bookings.booking.endDate" />,
    status:     <FormattedMessage id="ui-bookings.booking.status" />,
    recall:     <FormattedMessage id="ui-bookings.booking.recall" />,
    items:      <FormattedMessage id="ui-bookings.booking.itemCount" />,
    servicePoint: <FormattedMessage id="ui-bookings.booking.pickupServicePoint" />,
  };

  // ------------------------------------------------------------------
  // First pane: search sidebar + results list
  // ------------------------------------------------------------------

  const renderResultsPane = (searchAndSortProps) => {
    const {
      searchValue,
      getSearchHandlers,
      onSubmitSearch,
      resetAll,
      activeFilters,
      getFilterHandlers,
    } = searchAndSortProps;
    const filterHandlers = getFilterHandlers();

    const searchHandlers = getSearchHandlers();

    const actionMenu = ({ onToggle }) => (
      <>
        {canCreate && (
          <Button
            id="clickable-new-booking"
            buttonStyle="dropdownItem"
            onClick={() => { onToggle(); openCreate(); }}
          >
            <Icon icon="plus-sign">
              <FormattedMessage id="ui-bookings.booking.new" />
            </Icon>
          </Button>
        )}
        <Button
          id="clickable-export-bookings"
          buttonStyle="dropdownItem"
          disabled={isExporting || totalRecords === 0}
          onClick={() => { onToggle(); exportCsv(); }}
        >
          <Icon icon="arrow-down">
            <FormattedMessage id="ui-bookings.action.exportCsv" />
          </Icon>
        </Button>
      </>
    );

    const statusOptions = BOOKING_STATUSES.map(value => ({
      value,
      label: intl.formatMessage({ id: `ui-bookings.status.${value.toLowerCase()}` }),
    }));
    const recallOptions = [{
      value: 'true',
      label: intl.formatMessage({ id: 'ui-bookings.filters.recallRequired' }),
    }];

    const filterPane = (
      <Pane
        id="bookings-filter-pane"
        defaultWidth="22%"
        paneTitle={<FormattedMessage id="ui-bookings.filters.title" />}
      >
        <ViewSwitcher
          active="bookings"
          onChange={(view) => view === 'events' && history.push(`${match.path}/events`)}
        />
        <form onSubmit={onSubmitSearch}>
          <SearchField
            id="bookings-search-field"
            ariaLabel={intl.formatMessage({ id: 'ui-bookings.search' })}
            autoFocus
            onChange={searchHandlers.query}
            onClear={searchHandlers.reset}
            value={searchValue.query}
          />
          <Button
            type="submit"
            buttonStyle="primary"
            fullWidth
            disabled={!searchValue.query}
          >
            <FormattedMessage id="ui-bookings.action.search" />
          </Button>
          <Button
            buttonStyle="none"
            fullWidth
            onClick={resetAll}
          >
            <Icon icon="times-circle-solid">
              <FormattedMessage id="ui-bookings.action.resetAll" />
            </Icon>
          </Button>
        </form>
        <AccordionSet>
          <Accordion
            id="filter-status"
            label={<FormattedMessage id="ui-bookings.filters.status" />}
            header={FilterAccordionHeader}
            displayClearButton={(activeFilters.state.status || []).length > 0}
            onClearFilter={() => filterHandlers.clearGroup('status')}
          >
            <CheckboxFilter
              name="status"
              dataOptions={statusOptions}
              selectedValues={activeFilters.state.status}
              onChange={filterHandlers.state}
            />
          </Accordion>
          <Accordion
            id="filter-recall"
            label={<FormattedMessage id="ui-bookings.filters.recall" />}
            header={FilterAccordionHeader}
            displayClearButton={(activeFilters.state.recall || []).length > 0}
            onClearFilter={() => filterHandlers.clearGroup('recall')}
          >
            <CheckboxFilter
              name="recall"
              dataOptions={recallOptions}
              selectedValues={activeFilters.state.recall}
              onChange={filterHandlers.state}
            />
          </Accordion>
        </AccordionSet>
      </Pane>
    );

    const resultsPane = (
      <Pane
        id="bookings-results-pane"
        defaultWidth="fill"
        actionMenu={actionMenu}
        paneSub={
          isLoading
            ? <FormattedMessage id="ui-bookings.loading" />
            : <FormattedMessage
                id="ui-bookings.resultCount"
                values={{ count: totalRecords }}
              />
        }
        paneTitle={<FormattedMessage id="ui-bookings.meta.title" />}
      >
        {exportError && (
          <MessageBanner type="error" onExited={() => setExportError(null)}>{exportError}</MessageBanner>
        )}
        <MultiColumnList
          id="bookings-list"
          contentData={bookings}
          selectedRow={bookings.find(b => b.id === selectedBookingId)}
          columnMapping={columnMapping}
          columnWidths={COLUMN_WIDTHS}
          formatter={columnFormatters}
          visibleColumns={COLUMN_NAMES}
          onRowClick={(_, row) => openDetail(row)}
          isEmptyMessage={
            isLoading
              ? <FormattedMessage id="ui-bookings.loading" />
              : <FormattedMessage id="ui-bookings.noResults" />
          }
          totalCount={totalRecords}
        />
      </Pane>
    );

    return (
      <>
        {filterPane}
        {resultsPane}
      </>
    );
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
      <SearchAndSortQuery
        initialSearch=""
        initialSearchState={{ query: '' }}
        initialFilterState={{}}
        initialSortState={{ sort: '-startDate' }}
        queryGetter={() => resources?.query || {}}
        querySetter={({ nsValues }) => mutator.query.update(nsValues)}
        setQueryOnMount
      >
        {(searchAndSortProps) => (
          <Paneset>
            {renderResultsPane(searchAndSortProps)}

            <Switch>
              {/* Create new booking */}
              <Route
                path={`${match.path}/create`}
                render={(routeProps) => (
                  <BookingForm
                    {...routeProps}
                    stripes={stripes}
                    mutator={mutator}
                    onClose={closeThirdPane}
                    onSubmitSuccess={(booking) => {
                      closeThirdPane();
                      history.push(`${match.path}/${booking.id}`);
                    }}
                  />
                )}
              />

              {/* Edit existing booking */}
              <Route
                path={`${match.path}/:bookingId/edit`}
                render={(routeProps) => (
                  <BookingForm
                    {...routeProps}
                    stripes={stripes}
                    mutator={mutator}
                    bookingId={routeProps.match.params.bookingId}
                    onClose={() => history.push(`${match.path}/${routeProps.match.params.bookingId}`)}
                    onSubmitSuccess={(booking) => {
                      history.push(`${match.path}/${booking.id}`);
                    }}
                  />
                )}
              />

              {/* View booking detail */}
              <Route
                path={`${match.path}/:bookingId`}
                render={(routeProps) => (
                  <BookingDetail
                    {...routeProps}
                    stripes={stripes}
                    mutator={mutator}
                    bookingId={routeProps.match.params.bookingId}
                    canEdit={canCreate}
                    canDelete={canDelete}
                    onClose={closeThirdPane}
                    onEdit={() => history.push(`${match.path}/${routeProps.match.params.bookingId}/edit`)}
                    onDelete={closeThirdPane}
                  />
                )}
              />
            </Switch>
          </Paneset>
        )}
      </SearchAndSortQuery>
  );
};

BookingsApp.manifest = {
  query: {
    initialValue: {
      query: '',
      filters: '',
      sort: '-startDate',
    },
  },
  resultCount: { initialValue: 30 },
  bookings: BOOKINGS_RESOURCE,
};

BookingsApp.propTypes = {
  resources:  PropTypes.object.isRequired,
  mutator:    PropTypes.object.isRequired,
  match:      PropTypes.object.isRequired,
  history:    PropTypes.object.isRequired,
  location:   PropTypes.object.isRequired,
};

export default stripesConnect(BookingsApp);
