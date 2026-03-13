"""
Roads API endpoints for the graph/road builder.
"""
import os
import re
import requests
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, text
from app.core.config import settings
from app.database import engine

router = APIRouter()


class Coordinate(BaseModel):
    lat: float
    lng: float


class RouteRequest(BaseModel):
    points: List[Coordinate]


class RouteResponse(BaseModel):
    coordinates: List[Coordinate]
    distance_km: float
    duration_min: float


class SaveRoadRequest(BaseModel):
    name: str
    coordinates: List[Coordinate]
    distance_km: float
    highway_type: str = 'tertiary'


class RoadResponse(BaseModel):
    ref: str
    name: str
    highway_type: str
    length_km: float
    color: str


class RoadDetailResponse(BaseModel):
    ref: str
    name: str
    highway_type: str
    length_km: float
    color: str
    coordinates: List[Coordinate]


@router.post("/route/google", response_model=RouteResponse)
async def get_google_route(request: RouteRequest):
    """Get route using Google Directions API."""
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Google Maps API key not configured")

    points = request.points
    if len(points) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 points")

    origin = f"{points[0].lat},{points[0].lng}"
    destination = f"{points[-1].lat},{points[-1].lng}"

    params = {
        "origin": origin,
        "destination": destination,
        "key": api_key,
    }

    # Add waypoints if more than 2 points
    if len(points) > 2:
        waypoints = "|".join([f"{p.lat},{p.lng}" for p in points[1:-1]])
        params["waypoints"] = waypoints

    response = requests.get(
        "https://maps.googleapis.com/maps/api/directions/json",
        params=params
    )
    data = response.json()

    if data["status"] != "OK":
        raise HTTPException(status_code=400, detail=f"Google API error: {data['status']}")

    route = data["routes"][0]

    # Decode polyline
    from polyline import decode
    coords = decode(route["overview_polyline"]["points"])

    # Sum up distance and duration
    total_distance = sum(leg["distance"]["value"] for leg in route["legs"])
    total_duration = sum(leg["duration"]["value"] for leg in route["legs"])

    return RouteResponse(
        coordinates=[Coordinate(lat=c[0], lng=c[1]) for c in coords],
        distance_km=total_distance / 1000,
        duration_min=total_duration / 60
    )


@router.post("/save")
async def save_road(request: SaveRoadRequest):
    """Save a road to the major_roads table."""
    # Generate ref
    ref = f"MAN_{request.name[:40].replace(' ', '_')}"

    # Build LineString WKT (PostGIS uses lng, lat order)
    coords_str = ', '.join([f"{c.lng} {c.lat}" for c in request.coordinates])
    linestring_wkt = f"LINESTRING({coords_str})"

    # Color based on highway type
    colors = {
        'tertiary': '#3498DB',
        'secondary': '#F1C40F',
        'primary': '#E67E22',
        'trunk': '#E74C3C',
    }
    color = colors.get(request.highway_type, '#3498DB')

    with Session(engine) as session:
        # Check if exists
        existing = session.execute(
            text("SELECT id FROM major_roads WHERE ref = :ref"),
            {'ref': ref[:50]}
        ).fetchone()

        if existing:
            # Update
            session.execute(
                text("""
                    UPDATE major_roads
                    SET name = :name,
                        highway_type = :highway_type,
                        length_km = :length_km,
                        color = :color,
                        geom = ST_GeomFromText(:geom, 4326),
                        updated_at = NOW()
                    WHERE ref = :ref
                """),
                {
                    'ref': ref[:50],
                    'name': request.name[:200],
                    'highway_type': request.highway_type,
                    'length_km': round(request.distance_km, 2),
                    'color': color,
                    'geom': linestring_wkt,
                }
            )
        else:
            # Insert
            session.execute(
                text("""
                    INSERT INTO major_roads
                    (ref, name, highway_type, length_km, color, is_active, geom, created_at, updated_at)
                    VALUES (:ref, :name, :highway_type, :length_km, :color, true,
                            ST_GeomFromText(:geom, 4326), NOW(), NOW())
                """),
                {
                    'ref': ref[:50],
                    'name': request.name[:200],
                    'highway_type': request.highway_type,
                    'length_km': round(request.distance_km, 2),
                    'color': color,
                    'geom': linestring_wkt,
                }
            )

        session.commit()

    return {"message": "Road saved", "ref": ref}


@router.get("", response_model=List[RoadResponse])
async def list_roads():
    """List all saved roads."""
    with Session(engine) as session:
        result = session.execute(text("""
            SELECT ref, name, highway_type, length_km, color
            FROM major_roads
            ORDER BY highway_type, length_km DESC
        """)).fetchall()

        return [
            RoadResponse(
                ref=row[0],
                name=row[1] or '',
                highway_type=row[2],
                length_km=row[3],
                color=row[4]
            )
            for row in result
        ]


def parse_wkt_coordinates(geom_wkt: str) -> List[Coordinate]:
    """Parse WKT geometry to list of coordinates. Handles LINESTRING and MULTILINESTRING."""
    coordinates = []
    if not geom_wkt:
        return coordinates

    # Handle MULTILINESTRING - take the first linestring or merge all
    if geom_wkt.startswith('MULTILINESTRING'):
        # MULTILINESTRING((lng lat, lng lat), (lng lat, lng lat))
        # Extract content between outer parentheses
        import re
        matches = re.findall(r'\(([^()]+)\)', geom_wkt)
        for match in matches:
            for coord in match.split(','):
                parts = coord.strip().split(' ')
                if len(parts) >= 2:
                    try:
                        coordinates.append(Coordinate(lat=float(parts[1]), lng=float(parts[0])))
                    except ValueError:
                        continue

    elif geom_wkt.startswith('LINESTRING'):
        # LINESTRING(lng lat, lng lat, ...)
        coords_str = geom_wkt.replace('LINESTRING(', '').replace(')', '')
        for coord in coords_str.split(','):
            parts = coord.strip().split(' ')
            if len(parts) >= 2:
                try:
                    coordinates.append(Coordinate(lat=float(parts[1]), lng=float(parts[0])))
                except ValueError:
                    continue

    return coordinates


@router.get("/{ref}", response_model=RoadDetailResponse)
async def get_road(ref: str):
    """Get a road with its coordinates."""
    with Session(engine) as session:
        result = session.execute(
            text("""
                SELECT ref, name, highway_type, length_km, color,
                       ST_AsText(geom) as geom_wkt
                FROM major_roads
                WHERE ref = :ref
            """),
            {'ref': ref}
        ).fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="Road not found")

        geom_wkt = result[5]
        coordinates = parse_wkt_coordinates(geom_wkt)

        return RoadDetailResponse(
            ref=result[0],
            name=result[1] or '',
            highway_type=result[2],
            length_km=result[3],
            color=result[4],
            coordinates=coordinates
        )


@router.delete("/{ref}")
async def delete_road(ref: str):
    """Delete a road by ref."""
    with Session(engine) as session:
        result = session.execute(
            text("DELETE FROM major_roads WHERE ref = :ref RETURNING name"),
            {'ref': ref}
        ).fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="Road not found")

        session.commit()

    return {"message": "Road deleted", "name": result[0]}
