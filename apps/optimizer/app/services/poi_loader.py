"""
POI loader service.

Reads the curated Istanbul POI dataset from CSV and converts rows into
POI schema objects that the optimizer can consume directly.

The CSV lives at POI_DATA_PATH (configured in .env).  The loader is called
once at startup and the result is cached on app.state so every request reuses
the same in-memory list without re-reading disk.
"""

import csv
import uuid
from pathlib import Path

from app.config import settings
from app.schemas.common import BudgetRange, Location, OpeningHours, POICategory
from app.schemas.poi import POI

# Stable name→UUID mapping so poi_ids are consistent within a process lifetime.
_name_to_id: dict[str, str] = {}


def _get_or_create_id(name: str) -> str:
    if name not in _name_to_id:
        _name_to_id[name] = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"tripcholic.poi.{name}"))
    return _name_to_id[name]


def load_pois() -> list[POI]:
    """
    Load all POIs from the CSV dataset.
    Returns an empty list and logs a warning if the file is missing or malformed.
    """
    path = Path(settings.POI_DATA_PATH)
    if not path.exists():
        print(f"[poi_loader] WARNING: POI dataset not found at {path.resolve()}")
        return []

    pois: list[POI] = []
    with path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                poi = _row_to_poi(row)
                pois.append(poi)
            except Exception as exc:
                print(f"[poi_loader] Skipping row {row.get('name', '?')!r}: {exc}")

    print(f"[poi_loader] Loaded {len(pois)} POIs from {path.name}")
    return pois


def filter_pois(
    pois: list[POI],
    categories: list[POICategory] | None = None,
    budget_level: str | None = None,
    weather: str | None = None,
) -> list[POI]:
    """
    Filter the full POI list to candidates suitable for a given request.

    - categories: keep only POIs in these categories (None = all categories)
    - budget_level: 'low' | 'medium' | 'high' — keep POIs at or below this level
    - weather: 'rainy' — exclude purely outdoor POIs (scenic, nature, neighborhood)
    """
    outdoor_categories = {POICategory.SCENIC, POICategory.NATURE, POICategory.NEIGHBORHOOD}
    budget_order = {"low": 0, "medium": 1, "high": 2}
    max_budget_rank = budget_order.get((budget_level or "high").lower(), 2)

    result = []
    for poi in pois:
        if categories and poi.category not in categories:
            continue

        poi_budget_rank = _budget_rank(poi.budget)
        if poi_budget_rank > max_budget_rank:
            continue

        if weather and weather.lower() == "rainy" and poi.category in outdoor_categories:
            continue

        result.append(poi)

    return result


# ── Helpers ───────────────────────────────────────────────────────────────────

_BUDGET_RANK = {"low": 0, "medium": 1, "high": 2}


def _budget_rank(budget: BudgetRange) -> int:
    """Map a BudgetRange back to a rank for filtering."""
    if budget.max_tl <= 2000:
        return 0
    if budget.max_tl <= 6000:
        return 1
    return 2


def _parse_opening_hours(raw: str) -> OpeningHours:
    """Parse 'HH:MM-HH:MM' into an OpeningHours object."""
    open_str, close_str = raw.strip().split("-")
    return OpeningHours(open=open_str.strip(), close=close_str.strip())


def _row_to_poi(row: dict) -> POI:
    budget_range = BudgetRange.from_level(row["budget"].strip())
    return POI(
        poi_id=_get_or_create_id(row["name"].strip()),
        name=row["name"].strip(),
        location=Location(lat=float(row["lat"]), lng=float(row["lng"])),
        category=POICategory(row["category"].strip().lower()),
        opening_hours=_parse_opening_hours(row["opening_hours"]),
        budget=budget_range,
        visit_duration_minutes=int(row["avg_duration_min"]),
    )
