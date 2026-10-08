import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppButton } from './AppButton';

describe('AppButton', () => {
  it('renders an accessible button and handles presses', async () => {
    const onPress = jest.fn();
    await render(<AppButton label="Add your trip" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Add your trip' });
    await fireEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled and exposes the disabled state', async () => {
    const onPress = jest.fn();
    await render(<AppButton label="Continue" onPress={onPress} disabled />);

    const button = screen.getByRole('button', { name: 'Continue' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it('marks itself busy and blocks presses while loading', async () => {
    const onPress = jest.fn();
    await render(<AppButton label="Saving" onPress={onPress} loading />);

    const button = screen.getByRole('button', { name: 'Saving' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
  });
});
