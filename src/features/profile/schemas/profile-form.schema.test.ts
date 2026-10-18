import {
  profileBasicsFormSchema,
  toFormValues,
  toIsoDateOfBirth,
  toProfileUpdate,
} from './profile-form.schema';

const valid = {
  first_name: ' Maya ',
  dob_day: '7',
  dob_month: '3',
  dob_year: '1994',
  gender: 'woman',
  bio: '',
  home_city: 'Lisbon',
  home_country: '',
  occupation: '',
};

describe('profile basics form', () => {
  it('builds a ProfileUpdateInput with nulls for empty optional text', () => {
    const parsed = profileBasicsFormSchema.parse(valid);
    expect(toProfileUpdate(parsed)).toEqual({
      first_name: 'Maya',
      date_of_birth: '1994-03-07',
      gender: 'woman',
      bio: null,
      home_city: 'Lisbon',
      home_country: null,
      occupation: null,
    });
  });

  it('never includes server-owned fields', () => {
    const payload = toProfileUpdate(profileBasicsFormSchema.parse(valid));
    expect(Object.keys(payload)).toEqual(
      expect.not.arrayContaining([
        'id',
        'is_profile_complete',
        'created_at',
        'updated_at',
        'is_discoverable',
      ]),
    );
  });

  it('requires name, a real date and gender; enforces 18+', () => {
    expect(profileBasicsFormSchema.safeParse({ ...valid, first_name: '' }).success).toBe(false);
    expect(profileBasicsFormSchema.safeParse({ ...valid, gender: '' }).success).toBe(false);
    expect(
      profileBasicsFormSchema.safeParse({ ...valid, dob_day: '31', dob_month: '2' }).success,
    ).toBe(false);
    const minor = profileBasicsFormSchema.safeParse({
      ...valid,
      dob_year: String(new Date().getFullYear() - 15),
    });
    expect(minor.success).toBe(false);
    expect(JSON.stringify(minor.error?.issues)).toContain('18 or over');
  });

  it('validates calendar dates', () => {
    expect(toIsoDateOfBirth('2000', '2', '29')).toBe('2000-02-29');
    expect(toIsoDateOfBirth('2001', '2', '29')).toBeNull();
    expect(toIsoDateOfBirth('1899', '1', '1')).toBeNull();
  });

  it('prefills from an existing profile row', () => {
    expect(
      toFormValues({
        first_name: 'Asha',
        date_of_birth: '1995-05-17',
        gender: 'woman',
        bio: 'Hi',
        home_city: null,
        home_country: null,
        occupation: null,
      }),
    ).toMatchObject({
      first_name: 'Asha',
      dob_day: '17',
      dob_month: '05',
      dob_year: '1995',
      gender: 'woman',
      bio: 'Hi',
      home_city: '',
    });
  });
});
