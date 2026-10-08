import { act } from '@testing-library/react-native';

import { useUiStore } from './ui-store';

describe('ui store', () => {
  afterEach(() => useUiStore.setState({ activeSheet: null }));

  it('opens and closes a transient sheet', async () => {
    expect(useUiStore.getState().activeSheet).toBeNull();
    await act(() => useUiStore.getState().openSheet('foundation-info'));
    expect(useUiStore.getState().activeSheet).toBe('foundation-info');
    await act(() => useUiStore.getState().closeSheet());
    expect(useUiStore.getState().activeSheet).toBeNull();
  });
});
