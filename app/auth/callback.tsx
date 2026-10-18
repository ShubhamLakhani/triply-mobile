import { Redirect } from 'expo-router';

/**
 * Landing route for auth deep links (triply-*://auth/callback#access_token=…). The AuthProvider
 * consumes the tokens from the URL itself; this screen only returns to the guarded entry route.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
