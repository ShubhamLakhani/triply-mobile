import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Triply app configuration.
 *
 * One codebase, three installable variants selected by APP_VARIANT (set by each EAS profile):
 *   development → cc.toolmint.triply.dev      scheme triply-dev
 *   preview     → cc.toolmint.triply.preview  scheme triply-preview  (staging backend)
 *   production  → cc.toolmint.triply          scheme triply
 *
 * Only build-time, non-secret values are read here. Runtime public values (EXPO_PUBLIC_*)
 * are validated at app start in src/config/env.ts.
 */

export const APP_VARIANTS = ['development', 'preview', 'production'] as const;
export type AppVariant = (typeof APP_VARIANTS)[number];

const BASE_IDENTIFIER = 'cc.toolmint.triply';

/**
 * EAS project ID. Not a secret. Fill in after running `npx eas-cli init` (see README).
 * Until then, EAS Update is not configured and `updates.url` is omitted.
 */
// TODO(Phase 0M native verification): paste the ID printed by `npx eas-cli init`.
const EAS_PROJECT_ID = '';

interface VariantConfig {
  name: string;
  identifier: string;
  scheme: string;
}

const VARIANT_CONFIG: Record<AppVariant, VariantConfig> = {
  development: {
    name: 'Triply (Dev)',
    identifier: `${BASE_IDENTIFIER}.dev`,
    scheme: 'triply-dev',
  },
  preview: {
    name: 'Triply (Preview)',
    identifier: `${BASE_IDENTIFIER}.preview`,
    scheme: 'triply-preview',
  },
  production: {
    name: 'Triply',
    identifier: BASE_IDENTIFIER,
    scheme: 'triply',
  },
};

function isAppVariant(value: string): value is AppVariant {
  return (APP_VARIANTS as readonly string[]).includes(value);
}

export function resolveAppVariant(raw: string | undefined): AppVariant {
  const value = raw?.trim() || 'development';
  if (!isAppVariant(value)) {
    throw new Error(
      `[app.config] Invalid APP_VARIANT "${value}". Expected one of: ${APP_VARIANTS.join(', ')}.`,
    );
  }
  return value;
}

/**
 * Build-time guard: non-production variants must never point at the production Supabase project.
 * Active once TRIPLY_PRODUCTION_SUPABASE_REF is configured (Phase 1M creates the projects).
 */
export function assertBackendMatchesVariant(
  variant: AppVariant,
  supabaseUrl: string | undefined,
  productionRef: string | undefined,
): void {
  if (variant === 'production' || !supabaseUrl || !productionRef) return;
  if (supabaseUrl.includes(productionRef)) {
    throw new Error(
      `[app.config] APP_VARIANT=${variant} is configured with the PRODUCTION Supabase project. ` +
        'Preview/development builds must use staging or local backends.',
    );
  }
}

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const variant = resolveAppVariant(process.env.APP_VARIANT);
  const variantConfig = VARIANT_CONFIG[variant];

  assertBackendMatchesVariant(
    variant,
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.TRIPLY_PRODUCTION_SUPABASE_REF,
  );

  return {
    ...config,
    name: variantConfig.name,
    slug: 'triply',
    version: '0.1.0',
    scheme: variantConfig.scheme,
    platforms: ['ios', 'android'],
    orientation: 'portrait',
    // Light only until a dark theme is intentionally designed.
    userInterfaceStyle: 'light',
    backgroundColor: '#F7F6FB',
    // PLACEHOLDER brand assets — replace with final B3 exports (Visual Identity v1 §25).
    icon: './assets/images/placeholder-icon.png',
    runtimeVersion: { policy: 'appVersion' },
    ...(EAS_PROJECT_ID ? { updates: { url: `https://u.expo.dev/${EAS_PROJECT_ID}` } } : {}),
    ios: {
      bundleIdentifier: variantConfig.identifier,
      supportsTablet: false,
      config: {
        // Only standard HTTPS/OS-provided encryption is used. Confirm with legal before release.
        usesNonExemptEncryption: false,
      },
    },
    android: {
      package: variantConfig.identifier,
      adaptiveIcon: {
        foregroundImage: './assets/images/placeholder-adaptive-foreground.png',
        backgroundColor: '#6C4DF6',
      },
      // Do not restore auth sessions / app data onto other devices via Android Auto Backup.
      allowBackup: false,
      // Keep classic back behaviour until predictive back is tested across all flows.
      predictiveBackGestureEnabled: false,
      // The prebuild template declares the overlay permission; release builds don't need it.
      blockedPermissions:
        variant === 'development' ? [] : ['android.permission.SYSTEM_ALERT_WINDOW'],
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/placeholder-splash.png',
          imageWidth: 120,
          backgroundColor: '#F7F6FB',
        },
      ],
      [
        'expo-notifications',
        {
          color: '#6C4DF6',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Triply uses your photo library so you can choose pictures for your profile.',
          // Camera/microphone are not used yet; do not declare those permissions.
          cameraPermission: false,
          microphonePermission: false,
        },
      ],
      'expo-sqlite',
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          organization: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      appVariant: variant,
      ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
    },
  };
}
