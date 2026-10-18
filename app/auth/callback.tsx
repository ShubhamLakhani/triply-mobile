import { Redirect } from 'expo-router';

/**
 * DEPRECATED landing route for old email-confirmation links (`triply-*://auth/callback?code=…`).
 * New sign-ups use 6-digit codes; this stays for one compatibility release (see auth-links.ts).
 * AuthProvider exchanges the PKCE code itself; this screen only returns to the guarded entry.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
