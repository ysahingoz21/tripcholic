import TripStopsMapNative from './TripStopsMap.native';
import TripStopsMapWeb from './TripStopsMap.web';
import type { TripStopsMapProps } from './tripMapUtils';

export default function TripStopsMap(props: TripStopsMapProps) {
  if (typeof document !== 'undefined') {
    return <TripStopsMapWeb {...props} />;
  }

  return <TripStopsMapNative {...props} />;
}
