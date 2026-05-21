import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';

function getInitials(displayName: string | null | undefined, email?: string | null): string {
  const source = displayName?.trim() || email?.split('@')[0] || 'T';
  const parts = source.split(/[\s._-]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

type Props = {
  avatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: number;
  ringSize?: number;
  ringColor?: string;
};

export default function UserAvatar({
  avatarUrl,
  displayName,
  email,
  size = 80,
  ringSize = 4,
  ringColor = theme.colors.background,
}: Props) {
  const total = size + ringSize * 2;
  const fontSize = Math.round(size * 0.33);
  const initials = getInitials(displayName, email);

  return (
    <View style={[styles.ring, { width: total, height: total, borderRadius: total / 2, backgroundColor: ringColor }]}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    backgroundColor: theme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontFamily: font.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
