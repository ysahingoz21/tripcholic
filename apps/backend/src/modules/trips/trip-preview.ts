export type TripPreview = {
  headline: string;
  subheadline: string | null;
  primaryCategory: string | null;
  districtLabel: string | null;
  stopCount: number;
  hasMapData: boolean;
  hasPoiImage: boolean;
  imageUrl: string | null;
};

type PreviewStop = {
  category: string;
  district: string | null;
  imageUrl: string | null;
  coordinates: {
    lat: number | null;
    lng: number | null;
  };
};

export function buildTripPreview(input: {
  title: string;
  routeName: string | null;
  categories: string[];
  routeTotalDurationMin: number | null;
  routeTotalCostTl: number | null;
  stops: PreviewStop[];
  coverImageUrl?: string | null;
}): TripPreview {
  const stopCount = input.stops.length;
  const districtLabel = resolveTopDistrict(input.stops);
  const poiImageUrl =
    input.stops.find((stop) => typeof stop.imageUrl === 'string' && stop.imageUrl.trim())
      ?.imageUrl ?? null;
  const imageUrl = input.coverImageUrl?.trim() || poiImageUrl;
  const primaryCategory = resolvePrimaryCategory(
    input.categories,
    input.stops.map((stop) => stop.category),
  );
  const hasMapData = input.stops.some(
    (stop) =>
      stop.coordinates.lat !== null &&
      stop.coordinates.lng !== null,
  );

  return {
    headline: input.routeName ?? input.title,
    subheadline: buildTripPreviewSubheadline({
      stopCount,
      districtLabel,
      routeTotalDurationMin: input.routeTotalDurationMin,
      routeTotalCostTl: input.routeTotalCostTl,
    }),
    primaryCategory,
    districtLabel,
    stopCount,
    hasMapData,
    hasPoiImage: imageUrl !== null,
    imageUrl,
  };
}

function buildTripPreviewSubheadline(input: {
  stopCount: number;
  districtLabel: string | null;
  routeTotalDurationMin: number | null;
  routeTotalCostTl: number | null;
}): string | null {
  const parts: string[] = [];

  if (input.stopCount > 0) {
    if (input.districtLabel) {
      parts.push(
        `${input.stopCount} stop${input.stopCount === 1 ? '' : 's'} around ${input.districtLabel}`,
      );
    } else {
      parts.push(
        `${input.stopCount} stop${input.stopCount === 1 ? '' : 's'} planned`,
      );
    }
  } else if (input.districtLabel) {
    parts.push(`Centered around ${input.districtLabel}`);
  }

  if (input.routeTotalDurationMin !== null) {
    parts.push(`${input.routeTotalDurationMin} min`);
  }

  if (input.routeTotalCostTl !== null) {
    parts.push(`${Math.round(input.routeTotalCostTl)} TL`);
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join(' • ');
}

function resolvePrimaryCategory(
  tripCategories: string[],
  stopCategories: string[],
): string | null {
  const counts = new Map<string, number>();

  for (const category of stopCategories) {
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const topStopCategory = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];

  if (topStopCategory) {
    return topStopCategory;
  }

  return tripCategories[0] ?? null;
}

function resolveTopDistrict(
  stops: Array<{
    district: string | null;
  }>,
): string | null {
  const counts = new Map<string, number>();

  for (const stop of stops) {
    const district = stop.district?.trim();
    if (!district) {
      continue;
    }

    counts.set(district, (counts.get(district) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
}
