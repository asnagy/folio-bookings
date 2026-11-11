import React from 'react';

const STRIPES = {
  hasPerm: jest.fn().mockReturnValue(true),
  hasInterface: jest.fn().mockReturnValue(true),
  okapi: { tenant: 'diku', url: 'https://folio-testing-okapi.dev.folio.org' },
  timezone: 'UTC',
  locale: 'en-US',
  user: { user: { id: 'b1add99d-530b-5912-94f3-4091b4d87e2c', username: 'diku_admin' } },
};

jest.mock('@folio/stripes/core', () => ({
  ...jest.requireActual('@folio/stripes/core'),
  useStripes: jest.fn(() => STRIPES),
  useOkapiKy: jest.fn(() => ({
    get: jest.fn(() => ({ json: jest.fn().mockResolvedValue({}) })),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
  useCallout: jest.fn(() => ({ sendCallout: jest.fn() })),
  IfPermission: jest.fn(({ children }) => <>{children}</>),
  Pluggable: jest.fn(({ children }) => <>{children}</>),
}), { virtual: true });
