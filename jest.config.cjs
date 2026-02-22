module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'ts-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!(uuid)/)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFiles: ['<rootDir>/jest.env.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  coveragePathIgnorePatterns: [
    "\\.min\\.js$",
    "/public/emulatorjs/",
  ],
};