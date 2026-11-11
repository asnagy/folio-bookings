const path = require('path');
const stripesJestConfig = require('@folio/jest-config-stripes');

const config = stripesJestConfig.config || stripesJestConfig;

module.exports = {
  ...config,
  setupFiles: [
    ...config.setupFiles,
    path.join(__dirname, './test/jest/jest.setup.js'),
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/settings/index.js',
    '!**/node_modules/**',
  ],
};
