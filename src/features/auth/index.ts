export {
  getCurrentSession,
  getCurrentUser,
  requestPasswordReset,
  resendSignUpCode,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  subscribeToAuthChanges,
  updatePassword,
  verifyRecoveryCode,
  verifySignUpCode,
  type AuthChangeEvent,
  type Session,
  type SignUpResult,
  type User,
} from './api/auth-api';
export { createAuthCacheReset, registerAuthCacheReset } from './api/auth-cache';
export {
  AppAuthError,
  EMAIL_CODE_TTL_MS,
  toAuthError,
  toCodeError,
  type AuthErrorCode,
} from './api/auth-errors';
export { useAuthSession, type AuthSessionState } from './hooks/use-auth-session';
export { AuthProvider, useAuth, type AuthState } from './providers/AuthProvider';
export { AREA_HOME, resolveAppArea, type AppArea } from './routing/resolve-area';
export {
  credentialsSchema,
  EMAIL_CODE_LENGTH,
  emailCodeSchema,
  emailSchema,
  newPasswordSchema,
  passwordSchema,
  PASSWORD_MIN_LENGTH,
  type CredentialsInput,
} from './schemas/auth.schema';
