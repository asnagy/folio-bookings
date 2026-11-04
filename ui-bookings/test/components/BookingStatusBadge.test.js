import React from 'react';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import BookingStatusBadge from '../../src/components/BookingStatus/BookingStatusBadge';
import en from '../../translations/ui-bookings/en.json';

const renderWithIntl = (ui) =>
  render(
    <IntlProvider locale="en" messages={en}>
      {ui}
    </IntlProvider>
  );

describe('BookingStatusBadge', () => {
  it('renders PENDING status', () => {
    renderWithIntl(<BookingStatusBadge status="PENDING" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders RECALL_TRIGGERED status', () => {
    renderWithIntl(<BookingStatusBadge status="RECALL_TRIGGERED" />);
    expect(screen.getByText('Recall triggered')).toBeInTheDocument();
  });

  it('renders ACTIVE status', () => {
    renderWithIntl(<BookingStatusBadge status="ACTIVE" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders nothing when status is null', () => {
    const { container } = renderWithIntl(<BookingStatusBadge status={null} />);
    expect(container.firstChild).toBeNull();
  });
});
