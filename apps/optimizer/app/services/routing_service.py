import math

import httpx

from app.config import settings
from app.schemas.poi import POI

# Walking speed used for Haversine fallback and distance estimation
_WALK_SPEED_KMH = 5.0

# OSRM public instance — free, no API key, handles real Istanbul road network
# including Bosphorus crossings and ferry routes.
_OSRM_TABLE_URL = "{base}/table/v1/foot/{coords}?annotations=duration"


def _haversine_minutes(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Straight-line distance converted to walking minutes at 5 km/h."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    dist_km = 2 * R * math.asin(math.sqrt(a))
    return (dist_km / _WALK_SPEED_KMH) * 60


def build_travel_matrix(pois: list[POI]) -> tuple[list[list[float]], str]:
    """
    Returns (matrix, source) where matrix[i][j] is the walking travel time in
    minutes from pois[i] to pois[j], and source is "osrm" | "haversine" | "none".

    Tries OSRM Table API first (free, no key, real road network).
    Falls back to Haversine on any network error or timeout.
    """
    n = len(pois)
    if n == 0:
        return [], "none"

    matrix = _fetch_osrm_matrix(pois)
    if matrix is not None:
        return matrix, "osrm"

    return _haversine_matrix(pois), "haversine"


def _fetch_osrm_matrix(pois: list[POI]) -> list[list[float]] | None:
    """
    Calls the OSRM Table API (foot profile) on the public instance.

    OSRM coordinate format: lng,lat;lng,lat;...
    OSRM response: { "durations": [[seconds,...], ...] }
    Returns NxN matrix in minutes, or None on any failure.
    """
    coords = ";".join(f"{poi.location.lng},{poi.location.lat}" for poi in pois)
    url = _OSRM_TABLE_URL.format(base=settings.OSRM_BASE_URL, coords=coords)

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
            [(sec / 60.0 if sec is not None else _haversine_minutes(
                pois[i].location.lat, pois[i].location.lng,
                pois[j].location.lat, pois[j].location.lng,
            )) for j, sec in enumerate(row)]
            for i, row in enumerate(durations_sec)
        ]

    except Exception:
        return None


def _haversine_matrix(pois: list[POI]) -> list[list[float]]:
    n = len(pois)
    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                matrix[i][j] = _haversine_minutes(
                    pois[i].location.lat, pois[i].location.lng,
                    pois[j].location.lat, pois[j].location.lng,
                )
    return matrix
