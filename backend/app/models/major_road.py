"""
Major Road model for storing delivery corridors from OpenStreetMap.
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
    A major road/corridor used for delivery batching.
    Geometry stored as PostGIS for spatial queries.
    """
    __tablename__ = "major_roads"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Road identification from OSM
    ref: str = Field(max_length=50, unique=True, index=True,
                     description="Road reference (e.g., 'RN 30', 'CW 11')")

    name: Optional[str] = Field(default=None, max_length=200,
                                description="Road name from OSM")

    highway_type: str = Field(max_length=50,
                              description="OSM highway type (trunk, primary, secondary)")

    # Statistics
    length_km: float = Field(default=0.0,
                             description="Total length in km within our area")

    # UI customization
    color: Optional[str] = Field(default=None, max_length=7,
                                 description="Hex color for map display")

    # Status
    is_active: bool = Field(default=True,
                            description="Whether this corridor is used for batching")

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Add geometry column separately (SQLModel doesn't support it directly)
MajorRoad.__table__.append_column(
    Column('geom', Geometry('MULTILINESTRING', srid=4326), nullable=True)
)

# Create spatial index after table creation
event.listen(
    MajorRoad.__table__,
    'after_create',
    DDL('CREATE INDEX IF NOT EXISTS idx_major_roads_geom ON major_roads USING GIST (geom)')
)


class MajorRoadCreate(SQLModel):
    """Model for creating a major road."""
    ref: str
    name: Optional[str] = None
    highway_type: str
    length_km: float = 0.0
    color: Optional[str] = None
    is_active: bool = True


class MajorRoadRead(SQLModel):
    """Model for reading a major road."""
    id: int
    ref: str
    name: Optional[str]
    highway_type: str
    length_km: float
    color: Optional[str]
    is_active: bool


class MajorRoadUpdate(SQLModel):
    """Model for updating a major road."""
    ref: Optional[str] = None
    name: Optional[str] = None
    highway_type: Optional[str] = None
    length_km: Optional[float] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
