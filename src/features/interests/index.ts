export {
  INTEREST_COLUMNS,
  addInterest,
  fetchActiveInterests,
  fetchOwnInterests,
  removeInterest,
  replaceOwnInterests,
} from './api/interest-api';
export { InterestError, type InterestErrorCode } from './api/interest-errors';
export { interestKeys } from './api/interest-keys';
export {
  useAddInterest,
  useInterests,
  useOwnInterests,
  useRemoveInterest,
  useReplaceInterests,
} from './hooks/use-interests';
export { interestSelectionSchema, type InterestSelectionInput } from './schemas/interest.schema';
export {
  MAX_INTERESTS,
  type Interest,
  type InterestSummary,
  type OwnInterest,
  type ProfileInterest,
} from './types';
