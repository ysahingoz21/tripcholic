import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { theme } from '@/constants/theme';

type ArtworkKind = 'trip' | 'poi';
type ArtworkVariant = 'cover' | 'thumbnail';

type Props = {
  imageUrl?: string | null;
  kind: ArtworkKind;
  variant: ArtworkVariant;
  label?: string;
  category?: string | null;
};

const PLACEHOLDERS = {
  trip: require('@/assets/images/placeholders/default-trip.png'),
  poi: require('@/assets/images/placeholders/default-poi.png'),
};

const POI_CATEGORY_PLACEHOLDERS: Record<string, ReturnType<typeof require>> = {
  food:          require('@/assets/images/placeholders/poi/poi-food.png'),
  historical:    require('@/assets/images/placeholders/poi/poi-historical.png'),
  nature:        require('@/assets/images/placeholders/poi/poi-nature.png'),
  scenic:        require('@/assets/images/placeholders/poi/poi-scenic.png'),
  entertainment: require('@/assets/images/placeholders/poi/poi-entertainment.png'),
  shopping:      require('@/assets/images/placeholders/poi/poi-shopping.png'),
  neighborhood:  require('@/assets/images/placeholders/poi/poi-neighborhood.png'),
};

const LOGO = require('@/assets/images/logos/logo-without-text.png');

export function getPoiImageSource(imageUrl?: string | null, category?: string | null) {
  const normalized = imageUrl?.trim() || null;
  if (normalized) return { uri: normalized };
  const key = category?.toLowerCase() ?? '';
  return POI_CATEGORY_PLACEHOLDERS[key] ?? PLACEHOLDERS.poi;
}

function PoiWatermark() {
  return (
    <View style={wmStyles.badge}>
      <Image source={LOGO} style={wmStyles.logo} contentFit="contain" />
    </View>
  );
}

/** Drop-in for screens that render POI images with custom container styles.
 *  Shows the Tripcholic watermark badge when imageUrl is absent. */
export function PoiImageCard({
  imageUrl,
  category,
  style,
}: {
  imageUrl?: string | null;
  category?: string | null;
  style?: object;
}) {
  const isPlaceholder = !imageUrl?.trim();
  return (
    <View style={[style, { overflow: 'hidden' }]}>
      <Image
        source={getPoiImageSource(imageUrl, category)}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={150}
      />
      {isPlaceholder && <PoiWatermark />}
    </View>
  );
}

export default function Artwork({ imageUrl, kind, variant, category }: Props) {
  const normalizedImageUrl = imageUrl?.trim() || null;
  const isPOIPlaceholder = kind === 'poi' && !normalizedImageUrl;

  const source = normalizedImageUrl
    ? { uri: normalizedImageUrl }
    : kind === 'poi'
      ? (POI_CATEGORY_PLACEHOLDERS[category?.toLowerCase() ?? ''] ?? PLACEHOLDERS.poi)
      : PLACEHOLDERS.trip;

  if (isPOIPlaceholder) {
    return (
      <View style={variant === 'cover' ? styles.coverContainer : styles.thumbnailContainer}>
        <Image
          source={source}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={150}
        />
        <PoiWatermark />
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={variant === 'cover' ? styles.coverImage : styles.thumbnailImage}
      contentFit="cover"
      transition={150}
    />
  );
}

const styles = StyleSheet.create({
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  thumbnailImage: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.md,
  },
  coverContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
});

const wmStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 16,
    height: 16,
  },
});
