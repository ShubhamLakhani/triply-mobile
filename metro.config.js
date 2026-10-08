// Sentry's Expo Metro config wraps Expo's default config and adds debug IDs for source maps.
// https://docs.sentry.io/platforms/react-native/manual-setup/expo/
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
