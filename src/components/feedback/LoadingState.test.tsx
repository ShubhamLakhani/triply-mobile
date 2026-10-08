import { render, screen } from '@testing-library/react-native';

import { LoadingState } from './LoadingState';

describe('LoadingState', () => {
  it('announces progress to assistive technology', async () => {
    await render(<LoadingState label="Finding travelers" />);
    expect(screen.getByRole('progressbar', { name: 'Finding travelers' })).toBeOnTheScreen();
  });
});
