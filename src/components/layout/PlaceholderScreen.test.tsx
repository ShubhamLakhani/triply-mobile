import { render, screen } from '@testing-library/react-native';

import { PlaceholderScreen } from './PlaceholderScreen';

describe('PlaceholderScreen', () => {
  it('renders the title as a header with the planned milestone', async () => {
    await render(
      <PlaceholderScreen
        testID="trips-screen"
        title="Trips"
        description="Your upcoming trips."
        plannedPhase="Phase 3M"
      />,
    );

    expect(screen.getByTestId('trips-screen')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Trips' })).toBeOnTheScreen();
    expect(screen.getByText(/built in Phase 3M/)).toBeOnTheScreen();
  });
});
