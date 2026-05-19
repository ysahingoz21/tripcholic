type RawParam = string | string[] | undefined;

export type TripRouteSource = 'my-trips' | 'results' | 'profile';

function getSingleParamValue(value: RawParam) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function getTripRouteSource(value: RawParam): TripRouteSource | null {
  const normalized = getSingleParamValue(value);

  if (
    normalized === 'my-trips' ||
    normalized === 'results' ||
    normalized === 'profile'
  ) {
    return normalized;
  }

  return null;
}

export function getTripReturnTripId(value: RawParam) {
  const normalized = getSingleParamValue(value)?.trim();
  return normalized || null;
}

export function buildTripDetailParams(
  tripId: string,
  options?: {
    source?: TripRouteSource;
    returnTripId?: string;
  }
) {
  return {
    pathname: '/trip/[id]' as const,
    params: {
      id: tripId,
      ...(options?.source ? { source: options.source } : {}),
      ...(options?.returnTripId ? { returnTripId: options.returnTripId } : {}),
    },
  };
}

export function buildTripEditParams(
  tripId: string,
  options?: {
    source?: TripRouteSource;
    returnTripId?: string;
    remix?: string;
  }
) {
  return {
    pathname: '/trip/[id]/edit' as const,
    params: {
      id: tripId,
      ...(options?.source ? { source: options.source } : {}),
      ...(options?.returnTripId ? { returnTripId: options.returnTripId } : {}),
      ...(options?.remix ? { remix: options.remix } : {}),
    },
  };
}

export function buildTripReturnTarget(params: {
  source?: RawParam;
  returnTripId?: RawParam;
}) {
  const source = getTripRouteSource(params.source);
  const returnTripId = getTripReturnTripId(params.returnTripId);

  if (source === 'results' && returnTripId) {
    return {
      label: 'Back to Results',
      href: {
        pathname: '/results' as const,
        params: {
          tripId: returnTripId,
        },
      },
    };
  }

  if (source === 'profile') {
    return {
      label: 'Back to Profile',
      href: '/(tabs)/profile' as const,
    };
  }

  return {
    label: 'Back to My Trips',
    href: '/(tabs)/trips' as const,
  };
}
