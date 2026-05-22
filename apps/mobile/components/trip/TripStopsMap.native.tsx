import { memo, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/constants/theme";
import {
  DEFAULT_MAP_HEIGHT,
  getMapRegion,
  getSmoothedPolylineCoordinates,
  getTripStopMapMarkers,
  type TripStopsMapProps,
} from "./tripMapUtils";

type ReactNativeMapsModule = typeof import("react-native-maps");
type TripStopMarkerProps = {
  id: string;
  order: number;
  title: string;
  latitude: number;
  longitude: number;
  Marker: ReactNativeMapsModule["Marker"];
};

const TRACK_VIEW_CHANGES_WINDOW_MS = 450;
const ROUTE_PREVIEW_COLOR = "rgba(14, 165, 164, 0.72)";

function getReactNativeMapsModule(): ReactNativeMapsModule | null {
  try {
    return require("react-native-maps") as ReactNativeMapsModule;
  } catch {
    return null;
  }
}

const TripStopMarker = memo(function TripStopMarker({
  id,
  order,
  title,
  latitude,
  longitude,
  Marker,
}: TripStopMarkerProps) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    setTracksViewChanges(true);

    const timeoutId = setTimeout(() => {
      setTracksViewChanges(false);
    }, TRACK_VIEW_CHANGES_WINDOW_MS);

    return () => clearTimeout(timeoutId);
  }, [id, order, title, latitude, longitude]);

  const coordinate = useMemo(
    () => ({
      latitude,
      longitude,
    }),
    [latitude, longitude],
  );

  return (
    <Marker
      coordinate={coordinate}
      title={`Stop ${order}: ${title}`}
      description={`Trip stop ${order}`}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 0.5 }}
      centerOffset={{ x: 0, y: 0 }}
    >
      <View style={styles.markerShell}>
        <View style={styles.markerCore}>
          <Text style={styles.markerText}>{order}</Text>
        </View>
      </View>
    </Marker>
  );
});

function TripStopsMap({
  stops,
  height = DEFAULT_MAP_HEIGHT,
  title = "Trip Stop Map",
  hideTitle = false,
  emptyTitle = "No route stops to map",
  emptySubtitle = "This trip does not have any persisted stop coordinates to display yet.",
  testID,
}: TripStopsMapProps) {
  const mapsModule = getReactNativeMapsModule();
  const markers = useMemo(() => getTripStopMapMarkers(stops), [stops]);
  const region = useMemo(() => getMapRegion(markers), [markers]);
  const polylineCoordinates = useMemo(
    () => getSmoothedPolylineCoordinates(markers),
    [markers],
  );
  const showPolyline = polylineCoordinates.length > 1;

  if (!mapsModule) {
    return (
      <View style={styles.card} testID={testID}>
        {!hideTitle && <Text style={styles.title}>{title}</Text>}
        <View style={[styles.emptyState, { minHeight: height }]}>
          <Text style={styles.emptyTitle}>Map unavailable in this build</Text>
          <Text style={styles.emptySubtitle}>
            Rebuild the native app or use a client that includes
            react-native-maps.
          </Text>
        </View>
      </View>
    );
  }

  if (!region || markers.length === 0) {
    return (
      <View style={styles.card} testID={testID}>
        {!hideTitle && <Text style={styles.title}>{title}</Text>}
        <View style={[styles.emptyState, { minHeight: height }]}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
        </View>
      </View>
    );
  }

  const MapView = mapsModule.default;
  const { Marker, Polyline } = mapsModule;

  return (
    <View style={styles.card} testID={testID}>
      {!hideTitle && <Text style={styles.title}>{title}</Text>}
      <MapView
        style={[styles.map, { height }]}
        initialRegion={region}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {showPolyline ? (
          <Polyline
            coordinates={polylineCoordinates}
            strokeColor={ROUTE_PREVIEW_COLOR}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}

        {markers.map((marker) => (
          <TripStopMarker
            key={marker.id}
            id={marker.id}
            order={marker.order}
            title={marker.title}
            latitude={marker.latitude}
            longitude={marker.longitude}
            Marker={Marker}
          />
        ))}
      </MapView>
      <Text style={styles.note}>
        Straight-line preview between persisted stops.
      </Text>
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
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 12,
  },
  map: {
    width: "100%",
    borderRadius: theme.radius.lg,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 10,
  },
  emptyState: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  markerShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#C8FBF7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: ROUTE_PREVIEW_COLOR,
  },
  markerCore: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  markerText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.white,
  },
});

export default memo(TripStopsMap);
