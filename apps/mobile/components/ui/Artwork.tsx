import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

type ArtworkKind = 'trip' | 'poi';
type ArtworkVariant = 'cover' | 'thumbnail';

type Props = {
  imageUrl?: string | null;
  kind: ArtworkKind;
  variant: ArtworkVariant;
  label?: string;
};

const PLACEHOLDERS = {
  trip: require('@/assets/images/placeholders/default-trip.png'),
  poi: require('@/assets/images/placeholders/default-poi.png'),
} as const;

export default function Artwork({ imageUrl, kind, variant }: Props) {
  const normalizedImageUrl = imageUrl?.trim() || null;
  const source = normalizedImageUrl ? { uri: normalizedImageUrl } : PLACEHOLDERS[kind];

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
});
