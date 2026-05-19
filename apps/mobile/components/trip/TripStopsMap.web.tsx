import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';
import {
  DEFAULT_MAP_HEIGHT,
  getTripStopMapMarkers,
  type TripStopsMapProps,
} from './tripMapUtils';

export default function TripStopsMap({
  stops,
  height = DEFAULT_MAP_HEIGHT,
  title = 'Trip Stop Map',
  emptyTitle = 'Map unavailable on web',
  emptySubtitle = 'Use mobile to view the interactive route map for this trip.',
  testID,
}: TripStopsMapProps) {
  const markers = getTripStopMapMarkers(stops);

  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.fallbackPanel, { minHeight: height }]}>
        {markers.length === 0 ? (
          <>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
          </>
        ) : (
          <>
            <Text style={styles.fallbackTitle}>Ordered trip stops</Text>
            <Text style={styles.fallbackSubtitle}>
              Mobile shows a straight-line preview between persisted stops.
            </Text>
            <View style={styles.stopList}>
              {markers.map((marker) => (
                <View key={marker.id} style={styles.stopRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{marker.order}</Text>
                  </View>
                  <Text style={styles.stopText}>{marker.title}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
  },
  fallbackPanel: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#F8FAFC',
    padding: theme.spacing.lg,
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  fallbackSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  stopList: {
    gap: theme.spacing.sm,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.white,
  },
  stopText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },
});
