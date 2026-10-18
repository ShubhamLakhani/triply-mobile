export {
  getCurrentSession,
  getCurrentUser,
  resendSignUpEmail,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  subscribeToAuthChanges,
  type AuthChangeEvent,
  type Session,
  type SignUpResult,
  type User,
} from './api/auth-api';
export { createAuthCacheReset, registerAuthCacheReset } from './api/auth-cache';
export { AppAuthError, toAuthError, type AuthErrorCode } from './api/auth-errors';
export { useAuthSession, type AuthSessionState } from './hooks/use-auth-session';
export { AuthProvider, useAuth, type AuthState } from './providers/AuthProvider';
export { AREA_HOME, resolveAppArea, type AppArea } from './routing/resolve-area';
export {
  credentialsSchema,
  emailSchema,
  passwordSchema,
  PASSWORD_MIN_LENGTH,
  type CredentialsInput,
} from './schemas/auth.schema';
