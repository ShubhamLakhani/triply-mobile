import { Link } from 'expo-router';

import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/ui/AppText';

export default function NotFoundScreen() {
  return (
    <AppScreen>
      <AppText variant="h2">This screen doesn’t exist</AppText>
      <Link href="/discover" accessibilityRole="link">
        <AppText variant="bodyStrong" color="primary">
          Go to Discover
        </AppText>
      </Link>
    </AppScreen>
  );
}
