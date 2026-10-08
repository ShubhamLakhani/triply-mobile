import { render, screen } from '@testing-library/react-native';

import { ConfigErrorScreen } from './ConfigErrorScreen';

const issues = [{ variable: 'EXPO_PUBLIC_SUPABASE_URL', message: 'is missing' }];

describe('ConfigErrorScreen', () => {
  it('lists the misconfigured variables in development builds', async () => {
    await render(<ConfigErrorScreen issues={issues} showDetails />);
    expect(screen.getByText('• EXPO_PUBLIC_SUPABASE_URL is missing')).toBeOnTheScreen();
  });

  it('hides configuration details in release builds', async () => {
    await render(<ConfigErrorScreen issues={issues} showDetails={false} />);
    expect(screen.queryByText(/EXPO_PUBLIC_SUPABASE_URL/)).not.toBeOnTheScreen();
    expect(screen.getByText(/This build is misconfigured/)).toBeOnTheScreen();
  });
});
