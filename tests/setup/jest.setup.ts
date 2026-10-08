/**
 * Global Jest setup for React Native Testing Library.
 * Mocks only native boundaries; app logic runs for real.
 */
import 'react-native-gesture-handler/jestSetup';
import { setUpTests } from 'react-native-reanimated';
import type * as SafeAreaContextMock from 'react-native-safe-area-context/jest/mock';

setUpTests();

jest.mock(
  'react-native-safe-area-context',
  () =>
    jest.requireActual<typeof SafeAreaContextMock>('react-native-safe-area-context/jest/mock')
      .default,
);

// @sentry/react-native starts module-level timers on import; tests never send events anyway.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  wrap: <T>(component: T): T => component,
}));
