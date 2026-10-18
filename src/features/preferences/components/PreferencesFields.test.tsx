import { isEveryone, toggleGenderPreference } from './PreferencesFields';

const ALL = ['man', 'woman', 'non_binary', 'other', 'prefer_not_to_say'] as const;

describe('gender preference toggling ("Everyone")', () => {
  it('Everyone selects every canonical value (no "everyone" value is ever stored)', () => {
    expect(toggleGenderPreference([], 'everyone')).toEqual([...ALL]);
    expect(toggleGenderPreference(['woman'], 'everyone')).toEqual([...ALL]);
    expect(isEveryone([...ALL])).toBe(true);
  });

  it('tapping Everyone again clears the selection (the form then blocks saving)', () => {
    expect(toggleGenderPreference([...ALL], 'everyone')).toEqual([]);
  });

  it('deselecting one value from Everyone keeps the other four', () => {
    const next = toggleGenderPreference([...ALL], 'other');
    expect(next).toEqual(['man', 'woman', 'non_binary', 'prefer_not_to_say']);
    expect(isEveryone(next)).toBe(false);
  });

  it('selecting the last missing value turns the selection into Everyone', () => {
    const next = toggleGenderPreference(
      ['man', 'woman', 'non_binary', 'other'],
      'prefer_not_to_say',
    );
    expect(isEveryone(next)).toBe(true);
  });

  it('individual toggles keep a stable canonical order', () => {
    expect(toggleGenderPreference(['woman'], 'man')).toEqual(['man', 'woman']);
    expect(toggleGenderPreference(['man', 'woman'], 'man')).toEqual(['woman']);
  });
});
