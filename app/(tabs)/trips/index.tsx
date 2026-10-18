import { ComingSoonScreen } from '@/components/layout/ComingSoonScreen';

export default function TripsScreen() {
  return (
    <ComingSoonScreen
      testID="trips-screen"
      title="Trips"
      icon="suitcase"
      headline="Where are you off to?"
      description="Add upcoming trips with dates and we’ll match you with people who’ll be there at the same time."
    />
  );
}
