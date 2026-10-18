import { Link } from 'expo-router';

import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/ui/AppText';

export default function NotFoundScreen() {
  return (
    <AppScreen>
      <AppText variant="h2">This screen doesn’t exist</AppText>
      <Link href="/" accessibilityRole="link">
        <AppText variant="bodyStrong" color="primary">
          Take me home
        </AppText>
      </Link>
    </AppScreen>
  );
}
