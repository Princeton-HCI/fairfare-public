import type { ArgyleIdentity } from '@src/lib/types';

const mockedArgyleIdentityResponse: ArgyleIdentity = {
  id: '99999999-9999-9999-9999-999999999999',
  account: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  address: {
    line1: '1234 Main St',
    line2: null,
    city: 'San Francisco',
    state: 'CA',
    postal_code: '94111',
    country: 'US'
  },
  first_name: 'Sarah',
  last_name: 'Longfield',
  full_name: 'Sarah Longfield',
  birth_date: '1985-04-17',
  email: 'test2@argyle.com',
  phone_number: '+18009000020',
  picture_url:
    'https://api-sandbox.argyle.com/v2/payroll-documents/018dade9-cc37-36d5-2cd0-a5d8724db1e3/file',
  employment_status: 'inactive',
  employment_type: 'contractor',
  job_title: null,
  ssn: '213-53-7066',
  marital_status: 'Married filing jointly',
  gender: 'Female',
  hire_date: '2021-06-15',
  termination_date: '2024-02-01',
  termination_reason: null,
  employer: 'Uber',
  // base_pay: [Object],
  pay_cycle: 'weekly',
  // platform_ids: [Object],
  created_at: '2024-02-15T17:56:37.620Z',
  updated_at: '2024-02-15T18:00:35.958Z',
  metadata: {}
};

export const generateMockedArgyleIdentityResponse = (overrides: Partial<ArgyleIdentity> = {}) => {
  return {
    ...mockedArgyleIdentityResponse,
    ...overrides
  };
};
