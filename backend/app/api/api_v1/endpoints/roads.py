"""
Roads API endpoints for the graph/road builder.
"""
import os
import requests
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, text
from app.database import engine
from app.models.major_road import get_road_color, ROAD_COLORS

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
    ref_short: str  # A, RN, CW, CC
    ref: str  # Full reference like "CW 11"
    coordinates: List[Coordinate]
    length_km: float
    time_minutes: float
    place_start: str | None = None
    place_end: str | None = None
    name: str | None = None


class RoadResponse(BaseModel):
    id: int
    ref_short: str
    ref: str
    length_km: float
    time_minutes: float
    color: str
    place_start: str | None
    place_end: str | None
    name: str | None
    start_lat: float | None
    start_lng: float | None
    end_lat: float | None
    end_lng: float | None


class RoadDetailResponse(RoadResponse):
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


@router.get("/colors")
async def get_colors():
    """Get available road colors by type."""
    return ROAD_COLORS


@router.post("/save")
async def save_road(request: SaveRoadRequest):
    """Save a road to the major_roads table."""
    # Get color based on road type
    color = get_road_color(request.ref_short)

    # Build LineString WKT (PostGIS uses lng, lat order)
    coords_str = ', '.join([f"{c.lng} {c.lat}" for c in request.coordinates])
    linestring_wkt = f"LINESTRING({coords_str})"

    # Build POINT WKT for start and end points
    start_coord = request.coordinates[0]
    end_coord = request.coordinates[-1]
    start_point_wkt = f"POINT({start_coord.lng} {start_coord.lat})"
    end_point_wkt = f"POINT({end_coord.lng} {end_coord.lat})"

    with Session(engine) as session:
        # Check if exists
        existing = session.execute(
            text("SELECT id FROM major_roads WHERE ref = :ref"),
            {'ref': request.ref[:50]}
        ).fetchone()

        if existing:
            # Update
            session.execute(
                text("""
                    UPDATE major_roads
                    SET ref_short = :ref_short,
                        length_km = :length_km,
                        time_minutes = :time_minutes,
                        color = :color,
                        place_start = :place_start,
                        place_end = :place_end,
                        name = :name,
                        geom = ST_GeomFromText(:geom, 4326),
                        start_point = ST_GeomFromText(:start_point, 4326),
                        end_point = ST_GeomFromText(:end_point, 4326),
                        updated_at = NOW()
                    WHERE ref = :ref
                """),
                {
                    'ref': request.ref[:50],
                    'ref_short': request.ref_short[:10],
                    'length_km': round(request.length_km, 2),
                    'time_minutes': round(request.time_minutes, 1),
                    'color': color,
                    'place_start': request.place_start[:100] if request.place_start else None,
                    'place_end': request.place_end[:100] if request.place_end else None,
                    'name': request.name[:200] if request.name else None,
                    'geom': linestring_wkt,
                    'start_point': start_point_wkt,
                    'end_point': end_point_wkt,
                }
            )
            road_id = existing[0]
        else:
            # Insert
            result = session.execute(
                text("""
                    INSERT INTO major_roads
                    (ref_short, ref, length_km, time_minutes, color, place_start, place_end, name, is_active, geom, start_point, end_point, created_at, updated_at)
                    VALUES (:ref_short, :ref, :length_km, :time_minutes, :color, :place_start, :place_end, :name, true,
                            ST_GeomFromText(:geom, 4326), ST_GeomFromText(:start_point, 4326), ST_GeomFromText(:end_point, 4326), NOW(), NOW())
                    RETURNING id
                """),
                {
                    'ref_short': request.ref_short[:10],
                    'ref': request.ref[:50],
                    'length_km': round(request.length_km, 2),
                    'time_minutes': round(request.time_minutes, 1),
                    'color': color,
                    'place_start': request.place_start[:100] if request.place_start else None,
                    'place_end': request.place_end[:100] if request.place_end else None,
                    'name': request.name[:200] if request.name else None,
                    'geom': linestring_wkt,
                    'start_point': start_point_wkt,
                    'end_point': end_point_wkt,
                }
            )
            road_id = result.fetchone()[0]

        session.commit()

    return {"message": "Road saved", "id": road_id, "ref": request.ref}


@router.put("/{road_id}")
async def update_road(road_id: int, request: SaveRoadRequest):
    """Update a road by ID."""
    color = get_road_color(request.ref_short)

    # Build LineString WKT
    coords_str = ', '.join([f"{c.lng} {c.lat}" for c in request.coordinates])
    linestring_wkt = f"LINESTRING({coords_str})"

    # Build POINT WKT for start and end points
    start_coord = request.coordinates[0]
    end_coord = request.coordinates[-1]
    start_point_wkt = f"POINT({start_coord.lng} {start_coord.lat})"
    end_point_wkt = f"POINT({end_coord.lng} {end_coord.lat})"

    with Session(engine) as session:
        existing = session.execute(
            text("SELECT id FROM major_roads WHERE id = :id"),
            {'id': road_id}
        ).fetchone()

        if not existing:
            raise HTTPException(status_code=404, detail="Road not found")

        session.execute(
            text("""
                UPDATE major_roads
                SET ref_short = :ref_short,
                    ref = :ref,
                    length_km = :length_km,
                    time_minutes = :time_minutes,
                    color = :color,
                    place_start = :place_start,
                    place_end = :place_end,
                    name = :name,
                    geom = ST_GeomFromText(:geom, 4326),
                    start_point = ST_GeomFromText(:start_point, 4326),
                    end_point = ST_GeomFromText(:end_point, 4326),
                    updated_at = NOW()
                WHERE id = :id
            """),
            {
                'id': road_id,
                'ref_short': request.ref_short[:10],
                'ref': request.ref[:50],
                'length_km': round(request.length_km, 2),
                'time_minutes': round(request.time_minutes, 1),
                'color': color,
                'place_start': request.place_start[:100] if request.place_start else None,
                'place_end': request.place_end[:100] if request.place_end else None,
                'name': request.name[:200] if request.name else None,
                'geom': linestring_wkt,
                'start_point': start_point_wkt,
                'end_point': end_point_wkt,
            }
        )
        session.commit()

    return {"message": "Road updated", "id": road_id}


@router.get("", response_model=List[RoadResponse])
async def list_roads():
    """List all saved roads."""
    with Session(engine) as session:
        result = session.execute(text("""
            SELECT id, ref_short, ref, length_km, time_minutes, color,
                   place_start, place_end, name,
                   ST_Y(start_point) as start_lat, ST_X(start_point) as start_lng,
                   ST_Y(end_point) as end_lat, ST_X(end_point) as end_lng
            FROM major_roads
            WHERE is_active = true
            ORDER BY ref_short, ref
        """)).fetchall()

        return [
            RoadResponse(
                id=row[0],
                ref_short=row[1],
                ref=row[2],
                length_km=row[3],
                time_minutes=row[4],
                color=row[5],
                place_start=row[6],
                place_end=row[7],
                name=row[8],
                start_lat=row[9],
                start_lng=row[10],
                end_lat=row[11],
                end_lng=row[12]
            )
            for row in result
        ]


def parse_wkt_coordinates(geom_wkt: str) -> List[Coordinate]:
    """Parse WKT LINESTRING to list of coordinates."""
    coordinates = []
    if not geom_wkt:
        return coordinates

    if geom_wkt.startswith('LINESTRING'):
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


@router.get("/{road_id}", response_model=RoadDetailResponse)
async def get_road(road_id: int):
    """Get a road with its coordinates."""
    with Session(engine) as session:
        result = session.execute(
            text("""
                SELECT id, ref_short, ref, length_km, time_minutes, color,
                       place_start, place_end, name, ST_AsText(geom) as geom_wkt,
                       ST_Y(start_point) as start_lat, ST_X(start_point) as start_lng,
                       ST_Y(end_point) as end_lat, ST_X(end_point) as end_lng
                FROM major_roads
                WHERE id = :id
            """),
            {'id': road_id}
        ).fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="Road not found")

        coordinates = parse_wkt_coordinates(result[9])

        return RoadDetailResponse(
            id=result[0],
            ref_short=result[1],
            ref=result[2],
            length_km=result[3],
            time_minutes=result[4],
            color=result[5],
            place_start=result[6],
            place_end=result[7],
            name=result[8],
            coordinates=coordinates,
            start_lat=result[10],
            start_lng=result[11],
            end_lat=result[12],
            end_lng=result[13]
        )


@router.delete("/{road_id}")
async def delete_road(road_id: int):
    """Delete a road by ID."""
    with Session(engine) as session:
        result = session.execute(
            text("DELETE FROM major_roads WHERE id = :id RETURNING ref"),
            {'id': road_id}
        ).fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="Road not found")

        session.commit()

    return {"message": "Road deleted", "ref": result[0]}
