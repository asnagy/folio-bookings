import { screen } from '@folio/jest-config-stripes/testing-library/react';
import userEvent from '@folio/jest-config-stripes/testing-library/user-event';

import { renderWithIntl } from '../../test/jest/helpers';
import ViewSwitcher from './ViewSwitcher';

describe('ViewSwitcher', () => {
  it('marks the active view as pressed', () => {
    renderWithIntl(<ViewSwitcher active="events" onChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Events' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Bookings' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange when the other view is chosen', () => {
    const onChange = jest.fn();
    renderWithIntl(<ViewSwitcher active="bookings" onChange={onChange} />);

    userEvent.click(screen.getByRole('button', { name: 'Events' }));

    expect(onChange).toHaveBeenCalledWith('events');
  });

  it('does nothing when the active view is clicked', () => {
    const onChange = jest.fn();
    renderWithIntl(<ViewSwitcher active="bookings" onChange={onChange} />);

    userEvent.click(screen.getByRole('button', { name: 'Bookings' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
