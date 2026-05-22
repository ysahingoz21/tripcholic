import type { Region } from 'react-native-maps';
import type { TripDetailResponse } from '@/services/trips';

export type TripStop = TripDetailResponse['stops'][number];

export type TripStopMapMarker = {
  id: string;
  order: number;
  title: string;
  latitude: number;
  longitude: number;
};

export type TripStopsMapProps = {
  stops: TripStop[];
  height?: number;
  title?: string;
  hideTitle?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  testID?: string;
};

export const DEFAULT_MAP_HEIGHT = 260;
export const MIN_LATITUDE_DELTA = 0.01;
export const MIN_LONGITUDE_DELTA = 0.01;
const REGION_PADDING_MULTIPLIER = 1.5;

function isValidLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  );
}

export function getTripStopLabel(stop: TripStop) {
  const primaryTitle = stop.title.trim();
  const fallbackTitle = stop.poi.title.trim();

  if (primaryTitle.length > 0) {
    return primaryTitle;
  }

  if (fallbackTitle.length > 0) {
    return fallbackTitle;
  }

  return `Stop ${stop.order}`;
}

export function getSortedTripStops(stops: TripStop[]) {
  return [...stops].sort((left, right) => left.order - right.order);
}

export function getTripStopMapMarkers(stops: TripStop[]): TripStopMapMarker[] {
  return getSortedTripStops(stops).flatMap((stop) => {
    const { lat, lng } = stop.poi.coordinates;

    if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
      return [];
    }

    return [
      {
        id: stop.id,
        order: stop.order,
        title: getTripStopLabel(stop),
        latitude: lat,
        longitude: lng,
      },
    ];
  });
}

export function getPolylineCoordinates(markers: TripStopMapMarker[]) {
  return markers.map((marker) => ({
    latitude: marker.latitude,
    longitude: marker.longitude,
  }));
}

export function getSmoothedPolylineCoordinates(
  markers: TripStopMapMarker[],
  segmentsPerStep = 8
) {
  const baseCoordinates = getPolylineCoordinates(markers);

  if (baseCoordinates.length <= 2) {
    return baseCoordinates;
  }

  const smoothedCoordinates: Array<{
    latitude: number;
    longitude: number;
  }> = [];

  for (let index = 0; index < baseCoordinates.length - 1; index += 1) {
    const previous =
      baseCoordinates[index - 1] ?? baseCoordinates[index];
    const current = baseCoordinates[index];
    const next = baseCoordinates[index + 1];
    const nextNext =
      baseCoordinates[index + 2] ?? baseCoordinates[index + 1];

    for (let step = 0; step < segmentsPerStep; step += 1) {
      const t = step / segmentsPerStep;
      const t2 = t * t;
      const t3 = t2 * t;

      smoothedCoordinates.push({
        latitude:
          0.5 *
          ((2 * current.latitude) +
            (-previous.latitude + next.latitude) * t +
            (2 * previous.latitude -
              5 * current.latitude +
              4 * next.latitude -
              nextNext.latitude) *
              t2 +
            (-previous.latitude +
              3 * current.latitude -
              3 * next.latitude +
              nextNext.latitude) *
              t3),
        longitude:
          0.5 *
          ((2 * current.longitude) +
            (-previous.longitude + next.longitude) * t +
            (2 * previous.longitude -
              5 * current.longitude +
              4 * next.longitude -
              nextNext.longitude) *
              t2 +
            (-previous.longitude +
              3 * current.longitude -
              3 * next.longitude +
              nextNext.longitude) *
              t3),
      });
    }
  }

  smoothedCoordinates.push(baseCoordinates[baseCoordinates.length - 1]);

  return smoothedCoordinates;
}

export function getMapRegion(markers: TripStopMapMarker[]): Region | null {
  if (markers.length === 0) {
    return null;
  }

  if (markers.length === 1) {
    return {
      latitude: markers[0].latitude,
      longitude: markers[0].longitude,
      latitudeDelta: MIN_LATITUDE_DELTA,
      longitudeDelta: MIN_LONGITUDE_DELTA,
    };
  }

  const latitudes = markers.map((marker) => marker.latitude);
  const longitudes = markers.map((marker) => marker.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeDelta = Math.max(
    (maxLatitude - minLatitude) * REGION_PADDING_MULTIPLIER,
    MIN_LATITUDE_DELTA
  );
  const longitudeDelta = Math.max(
    (maxLongitude - minLongitude) * REGION_PADDING_MULTIPLIER,
    MIN_LONGITUDE_DELTA
  );

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}
