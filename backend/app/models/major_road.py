"""
Major Road model for storing delivery corridors.
Uses PostGIS geometry for spatial queries.
"""
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, event
from sqlalchemy.schema import DDL
from geoalchemy2 import Geometry
from typing import Optional
from datetime import datetime, timezone


class MajorRoad(SQLModel, table=True):
    """
    A major road used for delivery batching.
    Geometry stored as PostGIS for spatial queries.
    """
    __tablename__ = "major_roads"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Road type: A (Autoroute), RN (Route Nationale), CW (Chemin Wilaya), CC (Chemin Communal)
    ref_short: str = Field(max_length=10, index=True,
                           description="Road type: A, RN, CW, CC")

    # Full reference (e.g., "CW 11", "RN 5", "A1")
    ref: str = Field(max_length=50, unique=True, index=True,
                     description="Full road reference")

    # Statistics
    length_km: float = Field(default=0.0,
                             description="Total length in km")

    time_minutes: float = Field(default=0.0,
                                description="Estimated travel time in minutes")

    # UI customization
    color: str = Field(max_length=7,
                       description="Hex color for map display")

    # Location info
    place_start: Optional[str] = Field(default=None, max_length=100,
                                       description="Start location name")

    place_end: Optional[str] = Field(default=None, max_length=100,
                                     description="End location name")

    # Note: start_point and end_point are POINT geometry columns added below

    # Display name
    name: Optional[str] = Field(default=None, max_length=200,
                                description="Road display name")

    # Status
    is_active: bool = Field(default=True,
                            description="Whether this road is used for batching")

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Add geometry columns separately (SQLModel doesn't support them directly)
# POINT columns first, then LINESTRING last
MajorRoad.__table__.append_column(
    Column('start_point', Geometry('POINT', srid=4326), nullable=True)
)
MajorRoad.__table__.append_column(
    Column('end_point', Geometry('POINT', srid=4326), nullable=True)
)
MajorRoad.__table__.append_column(
    Column('geom', Geometry('LINESTRING', srid=4326), nullable=True)
)

# Create spatial indices after table creation
event.listen(
    MajorRoad.__table__,
    'after_create',
    DDL('''
        CREATE INDEX IF NOT EXISTS idx_major_roads_geom ON major_roads USING GIST (geom);
        CREATE INDEX IF NOT EXISTS idx_major_roads_start_point ON major_roads USING GIST (start_point);
        CREATE INDEX IF NOT EXISTS idx_major_roads_end_point ON major_roads USING GIST (end_point);
    ''')
)


# Colors by road type
ROAD_COLORS = {
    'A': '#E74C3C',    # Autoroute - Red
    'RN': '#E67E22',   # Route Nationale - Orange
    'CW': '#F1C40F',   # Chemin Wilaya - Yellow
    'CC': '#3498DB',   # Chemin Communal - Blue
}


def get_road_color(ref_short: str) -> str:
    """Get color for road type."""
    return ROAD_COLORS.get(ref_short, '#999999')


class MajorRoadCreate(SQLModel):
    """Model for creating a major road."""
    ref_short: str
    ref: str
    length_km: float = 0.0
    time_minutes: float = 0.0
    place_start: Optional[str] = None
    place_end: Optional[str] = None
    name: Optional[str] = None


class MajorRoadRead(SQLModel):
    """Model for reading a major road."""
    id: int
    ref_short: str
    ref: str
    length_km: float
    time_minutes: float
    color: str
    place_start: Optional[str]
    place_end: Optional[str]
    name: Optional[str]
    start_lat: Optional[float]
    start_lng: Optional[float]
    end_lat: Optional[float]
    end_lng: Optional[float]
    is_active: bool


class MajorRoadUpdate(SQLModel):
    """Model for updating a major road."""
    ref_short: Optional[str] = None
    ref: Optional[str] = None
    length_km: Optional[float] = None
    time_minutes: Optional[float] = None
    place_start: Optional[str] = None
    place_end: Optional[str] = None
    name: Optional[str] = None
    is_active: Optional[bool] = None
