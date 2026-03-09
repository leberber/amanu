"""
Geospatial utilities using H3 indexing
"""
import h3
from typing import Optional


# Default resolution for H3 index
# Resolution 8 = ~460m edge length, good for neighborhood-level grouping
# Resolution 9 = ~174m edge length, more precise
DEFAULT_H3_RESOLUTION = 9


def lat_lng_to_h3(latitude: Optional[float], longitude: Optional[float], resolution: int = DEFAULT_H3_RESOLUTION) -> Optional[str]:
    """
    Convert latitude/longitude to H3 index.

    Args:
        latitude: Latitude coordinate
        longitude: Longitude coordinate
        resolution: H3 resolution (0-15), default 8

    Returns:
        H3 index string or None if coordinates are invalid
    """
    if latitude is None or longitude is None:
        return None

    try:
        return h3.latlng_to_cell(latitude, longitude, resolution)
    except Exception:
        return None


def h3_to_lat_lng(h3_index: str) -> Optional[tuple[float, float]]:
    """
    Convert H3 index back to latitude/longitude (cell center).

    Args:
        h3_index: H3 index string

    Returns:
        Tuple of (latitude, longitude) or None if invalid
    """
    if not h3_index:
        return None

    try:
        return h3.cell_to_latlng(h3_index)
    except Exception:
        return None


def get_h3_neighbors(h3_index: str, k: int = 1) -> list[str]:
    """
    Get neighboring H3 cells within k rings.

    Args:
        h3_index: H3 index string
        k: Number of rings (default 1 = immediate neighbors)

    Returns:
        List of H3 index strings including the original cell
    """
    if not h3_index:
        return []

    try:
        return list(h3.grid_disk(h3_index, k))
    except Exception:
        return []
