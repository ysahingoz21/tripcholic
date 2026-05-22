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

export type AvatarVariant = 'default' | 'header' | 'drawer' | 'profile';

/**
 * Total ring pixels added on each side by variant="profile".
 * (3px inner white + 3px colored + 4px outer white)
 * Export this so profile screens can compute `marginTop` correctly.
 */
export const PROFILE_AVATAR_FRAME_INSET = 10;

type Props = {
  avatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: number;
  /** Only used when variant="default". Ignored for named variants. */
  ringSize?: number;
  /** Only used when variant="default". Ignored for named variants. */
  ringColor?: string;
  variant?: AvatarVariant;
};

export default function UserAvatar({
  avatarUrl,
  displayName,
  email,
  size = 80,
  ringSize = 4,
  ringColor = theme.colors.background,
  variant = 'default',
}: Props) {
  const fontSize = Math.round(size * 0.33);
  const initials = getInitials(displayName, email);

  const circle = (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
      )}
    </View>
  );

  // ── header ──────────────────────────────────────────────────────────────────
  // Single thin turquoise ring (low opacity). No white separator layer.
  if (variant === 'header') {
    const d = size + 4; // 2px ring per side
    return (
      <View style={[styles.ring, { width: d, height: d, borderRadius: d / 2, backgroundColor: HEADER_RING }]}>
        {circle}
      </View>
    );
  }

  // ── drawer ───────────────────────────────────────────────────────────────────
  // White inner ring (3px) + dark green outer ring (3px).
  if (variant === 'drawer') {
    const dWhite = size + 6;  // 3px white per side
    const dDark  = size + 12; // 3px dark per side
    return (
      <View style={[styles.ring, { width: dDark,  height: dDark,  borderRadius: dDark  / 2, backgroundColor: theme.colors.primaryDark }]}>
        <View style={[styles.ring, { width: dWhite, height: dWhite, borderRadius: dWhite / 2, backgroundColor: theme.colors.surface }]}>
          {circle}
        </View>
      </View>
    );
  }

  // ── profile ──────────────────────────────────────────────────────────────────
  // White outer (4px) → turquoise band (3px) → white inner (3px) → avatar.
  // Total added per side = PROFILE_AVATAR_FRAME_INSET (10px); * 2 sides = 20px.
  if (variant === 'profile') {
    const dInner   = size + 6;   // 3px white inner
    const dColored = size + 12;  // 3px turquoise band
    const dOuter   = size + 20;  // 4px white outer
    return (
      <View style={[styles.ring, { width: dOuter,   height: dOuter,   borderRadius: dOuter   / 2, backgroundColor: theme.colors.surface }]}>
        <View style={[styles.ring, { width: dColored, height: dColored, borderRadius: dColored / 2, backgroundColor: theme.colors.primary }]}>
          <View style={[styles.ring, { width: dInner,   height: dInner,   borderRadius: dInner   / 2, backgroundColor: theme.colors.surface }]}>
            {circle}
          </View>
        </View>
      </View>
    );
  }

  // ── default ──────────────────────────────────────────────────────────────────
  // Existing behaviour: optional single ring using ringSize / ringColor.
  if (ringSize > 0) {
    const total = size + ringSize * 2;
    return (
      <View style={[styles.ring, { width: total, height: total, borderRadius: total / 2, backgroundColor: ringColor }]}>
        {circle}
      </View>
    );
  }

  return circle;
}

// Turquoise at 40% opacity — sits cleanly on the light header background
const HEADER_RING = 'rgba(14, 165, 164, 0.40)';

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
