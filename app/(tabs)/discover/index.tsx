import { ComingSoonScreen } from '@/components/layout/ComingSoonScreen';

export default function DiscoverScreen() {
  return (
    <ComingSoonScreen
      testID="discover-screen"
      title="Discover"
      icon="compass"
      headline="People heading your way"
      description="We’ll show travellers going to the same destination on overlapping dates, ranked by how much time you’d share."
    />
  );
}
