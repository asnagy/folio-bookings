import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Route, Switch } from 'react-router-dom';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  MultiColumnList,
  Pane,
  PaneMenu,
  Paneset,
  SearchField,
  Button,
  Icon,
} from '@folio/stripes/components';
import { SearchAndSortQuery } from '@folio/stripes/smart-components';
import { stripesConnect, useStripes } from '@folio/stripes/core';

import BookingDetail from './BookingDetail/BookingDetail';
import BookingForm from './BookingForm/BookingForm';
import { BOOKINGS_RESOURCE } from '../manifest';
import BookingStatusBadge from './BookingStatus/BookingStatusBadge';
import { formatDateTimeDisplay } from '../util/bookingUtils';

import css from './BookingsApp.css';

const COLUMN_WIDTHS = {
  patronName:  '20%',
  startDate:   '15%',
  endDate:     '15%',
  status:      '15%',
  itemCount:   '10%',
  notes:       '25%',
};

const COLUMN_NAMES = ['patronName', 'startDate', 'endDate', 'status', 'itemCount', 'notes'];

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

  const columnFormatters = {
    patronName: (row) => {
      const p = row.patron;
      if (!p) return row.userId || '—';
      return `${p.lastName || ''}, ${p.firstName || ''}`.trim().replace(/^,\s*/, '') || row.userId;
    },
    startDate: (row) => formatDateTimeDisplay(row.startDate),
    endDate:   (row) => formatDateTimeDisplay(row.endDate),
    status:    (row) => <BookingStatusBadge status={row.status} />,
    itemCount: (row) => (row.items ? row.items.length : '—'),
    notes:     (row) => row.notes || '—',
  };

  const columnMapping = {
    patronName: <FormattedMessage id="ui-bookings.booking.patron" />,
    startDate:  <FormattedMessage id="ui-bookings.booking.startDate" />,
    endDate:    <FormattedMessage id="ui-bookings.booking.endDate" />,
    status:     <FormattedMessage id="ui-bookings.booking.status" />,
    itemCount:  <FormattedMessage id="ui-bookings.booking.itemCount" />,
    notes:      <FormattedMessage id="ui-bookings.booking.notes" />,
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
    } = searchAndSortProps;

    const searchHandlers = getSearchHandlers();

    const actionMenu = canCreate
      ? ({ onToggle }) => (
        <Button
          id="clickable-new-booking"
          buttonStyle="dropdownItem"
          onClick={() => { onToggle(); openCreate(); }}
        >
          <Icon icon="plus-sign">
            <FormattedMessage id="ui-bookings.booking.new" />
          </Icon>
        </Button>
      )
      : null;

    return (
      <Pane
        id="bookings-results-pane"
        defaultWidth="fill"
        firstMenu={
          <PaneMenu>
            <SearchField
              id="bookings-search-field"
              ariaLabel={intl.formatMessage({ id: 'ui-bookings.search' })}
              onChange={searchHandlers.query}
              onClear={searchHandlers.reset}
              onSubmit={onSubmitSearch}
              value={searchValue.query}
              marginBottom0
            />
          </PaneMenu>
        }
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
          autosize
          virtualize
        />
      </Pane>
    );
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
      <SearchAndSortQuery
        initialSearch=""
        initialSearchState={{ query: '' }}
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
