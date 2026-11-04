const path = require('path');

module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/test/**/*.test.{js,jsx}', '**/__tests__/**/*.{js,jsx}'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '\\.(css|less)$': '<rootDir>/test/__mocks__/styleMock.js',
    '@folio/stripes/components': '<rootDir>/test/__mocks__/stripes-components.js',
    '@folio/stripes/core':       '<rootDir>/test/__mocks__/stripes-core.js',
    '@folio/stripes/connect':    '<rootDir>/test/__mocks__/stripes-connect.js',
    '@folio/stripes/smart-components': '<rootDir>/test/__mocks__/stripes-smart-components.js',
  },
  setupFilesAfterFramework: [
    '@testing-library/jest-dom',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/settings/index.js',
  ],
};
