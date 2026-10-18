import { fireEvent, render, screen } from '@testing-library/react-native';

import type { InterestSummary } from '../types';

import { InterestPicker } from './InterestPicker';

const catalog: InterestSummary[] = Array.from({ length: 12 }, (_, i) => ({
  id: `e0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  slug: `interest-${i + 1}`,
  label: `Interest ${i + 1}`,
  category: i < 6 ? 'outdoors' : 'culture',
}));

describe('InterestPicker', () => {
  it('groups by category, counts selections and toggles chips', async () => {
    const onToggle = jest.fn();
    await render(
      <InterestPicker
        catalog={catalog}
        selectedIds={[catalog[0]!.id]}
        onToggle={onToggle}
        testID="picker"
      />,
    );
    expect(screen.getByText('OUTDOORS')).toBeOnTheScreen();
    expect(screen.getByText('CULTURE')).toBeOnTheScreen();
    expect(screen.getByTestId('picker-count')).toHaveTextContent(/^1 of 10 chosen/);
    await fireEvent.press(screen.getByTestId('interest-interest-2'));
    expect(onToggle).toHaveBeenCalledWith(catalog[1]!.id);
    expect(screen.getByTestId('interest-interest-1').props.accessibilityState.checked).toBe(true);
  });

  it('disables unselected chips at the 10 limit but still allows deselecting', async () => {
    const onToggle = jest.fn();
    const ten = catalog.slice(0, 10).map((c) => c.id);
    await render(
      <InterestPicker catalog={catalog} selectedIds={ten} onToggle={onToggle} testID="picker" />,
    );
    expect(screen.getByTestId('picker-count')).toHaveTextContent(/10 of 10 chosen/);
    expect(screen.getByTestId('interest-interest-11').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId('interest-interest-11'));
    expect(onToggle).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('interest-interest-3'));
    expect(onToggle).toHaveBeenCalledWith(catalog[2]!.id);
  });

  it('shows a skeleton while the catalog loads', async () => {
    await render(
      <InterestPicker
        catalog={undefined}
        selectedIds={[]}
        onToggle={jest.fn()}
        isLoading
        testID="picker"
      />,
    );
    expect(screen.getByTestId('picker-loading')).toBeOnTheScreen();
  });

  it('explains an empty catalog instead of showing a bare counter', async () => {
    await render(
      <InterestPicker catalog={[]} selectedIds={[]} onToggle={jest.fn()} testID="picker" />,
    );
    expect(screen.getByTestId('picker-empty')).toHaveTextContent(/no interests to choose from/);
    expect(screen.queryByTestId('picker-count')).toBeNull();
  });
});
