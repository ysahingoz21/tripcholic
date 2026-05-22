import math

import httpx

from app.config import settings
from app.schemas.poi import POI

# Travel-time constants used for local walking and citywide transfer estimates.
_WALK_SPEED_KMH = 5.0
_CITY_TRANSFER_SPEED_KMH = 22.0
_CITY_TRANSFER_FIXED_MIN = 12.0
_ROAD_DETOUR_FACTOR = 1.25
_BOSPHORUS_CROSSING_PENALTY_MIN = 15.0
_ISLAND_TRANSFER_PENALTY_MIN = 45.0

# OSRM public instance — free, no API key. We use foot for local walking legs
# and driving as a pragmatic city-transfer proxy for longer hops.
_OSRM_TABLE_URL = "{base}/table/v1/{profile}/{coords}?annotations=duration"


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _walking_minutes(distance_km: float) -> float:
    return (distance_km / _WALK_SPEED_KMH) * 60


def _is_adalar(poi: POI) -> bool:
    return poi.location.lat < 40.93 and poi.location.lng > 28.95


def _is_asian_side(poi: POI) -> bool:
    return poi.location.lng >= 29.02


def _transfer_minutes(poi_a: POI, poi_b: POI, distance_km: float) -> float:
    """
    Coarse Istanbul city-transfer estimate for legs that exceed the user's
    walking comfort. This avoids treating Sarıyer↔Kadıköy as a 5 km/h
    straight-line walk while still keeping the optimizer deterministic when
    OSRM is unavailable.
    """
    effective_km = distance_km * _ROAD_DETOUR_FACTOR
    minutes = (effective_km / _CITY_TRANSFER_SPEED_KMH) * 60 + _CITY_TRANSFER_FIXED_MIN

    if _is_asian_side(poi_a) != _is_asian_side(poi_b):
        minutes += _BOSPHORUS_CROSSING_PENALTY_MIN

    if _is_adalar(poi_a) != _is_adalar(poi_b):
        minutes += _ISLAND_TRANSFER_PENALTY_MIN

    return minutes


def build_travel_matrix(
    pois: list[POI],
    walking_tolerance_km: float = 3.0,
) -> tuple[list[list[float]], str]:
    """
    Returns (matrix, source) where matrix[i][j] is the travel time in minutes
    from pois[i] to pois[j].

    Short legs within walking_tolerance_km use walking time. Longer legs use a
    city-transfer estimate, optionally seeded from OSRM's driving profile when
    available. This keeps the route feasible across Istanbul without pretending
    every inter-district hop must be walked.
    """
    n = len(pois)
    if n == 0:
        return [], "none"

    foot_matrix = _fetch_osrm_matrix(pois, "foot")
    transfer_matrix = _fetch_osrm_matrix(pois, "driving")
    matrix = _compose_multimodal_matrix(
        pois,
        walking_tolerance_km=walking_tolerance_km,
        foot_matrix=foot_matrix,
        transfer_matrix=transfer_matrix,
    )

    if foot_matrix is not None or transfer_matrix is not None:
        return matrix, "osrm"

    return matrix, "multimodal_estimate"


def _fetch_osrm_matrix(pois: list[POI], profile: str) -> list[list[float | None]] | None:
    """
    Calls the OSRM Table API for one profile on the public instance.

    OSRM coordinate format: lng,lat;lng,lat;...
    OSRM response: { "durations": [[seconds,...], ...] }
    Returns NxN matrix in minutes, or None on any failure.
    """
    coords = ";".join(f"{poi.location.lng},{poi.location.lat}" for poi in pois)
    url = _OSRM_TABLE_URL.format(
        base=settings.OSRM_BASE_URL,
        profile=profile,
        coords=coords,
    )

    try:
        with httpx.Client(timeout=2.0) as client:
            response = client.get(url)
            response.raise_for_status()
            data = response.json()

        if data.get("code") != "Ok":
            return None

        durations_sec: list[list[float]] = data["durations"]
        # Convert seconds → minutes; OSRM may return null for unreachable pairs
        return [
            [(sec / 60.0 if sec is not None else None) for sec in row]
            for i, row in enumerate(durations_sec)
        ]

    except Exception:
        return None


def _compose_multimodal_matrix(
    pois: list[POI],
    walking_tolerance_km: float,
    foot_matrix: list[list[float | None]] | None,
    transfer_matrix: list[list[float | None]] | None,
) -> list[list[float]]:
    n = len(pois)
    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                distance_km = _haversine_km(
                    pois[i].location.lat, pois[i].location.lng,
                    pois[j].location.lat, pois[j].location.lng,
                )
                if distance_km <= walking_tolerance_km:
                    fallback = _walking_minutes(distance_km * _ROAD_DETOUR_FACTOR)
                    matrix[i][j] = _matrix_value(foot_matrix, i, j, fallback)
                else:
                    fallback = _transfer_minutes(pois[i], pois[j], distance_km)
                    matrix[i][j] = _matrix_value(transfer_matrix, i, j, fallback)
    return matrix


def _matrix_value(
    matrix: list[list[float | None]] | None,
    i: int,
    j: int,
    fallback: float,
) -> float:
    if matrix is None:
        return fallback
    value = matrix[i][j]
    if value is None:
        return fallback
    return value
