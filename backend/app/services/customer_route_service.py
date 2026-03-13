"""
Customer Route Service
Handles routing using OSMnx and PostGIS for corridor assignment.
"""
import osmnx as ox
from shapely.geometry import LineString
from shapely import wkb
from geoalchemy2.shape import from_shape, to_shape
from typing import Optional, List, Dict, Tuple
from datetime import datetime, timezone
from sqlmodel import Session, select
from sqlalchemy import text
from functools import lru_cache

from app.core.config import settings
from app.models.customer_route import CustomerRoute
from app.models.major_road import MajorRoad


# Cache for OSM graph (loaded once)
_osm_graph = None
_osm_graph_loaded = False


def get_osm_graph():
    """
    Get OSMnx graph for the depot area.
    Loaded once and cached for performance.
    """
    global _osm_graph, _osm_graph_loaded

    if _osm_graph_loaded:
        return _osm_graph

    try:
        print("Loading OSM graph...")
        # Download road network around depot (25km radius)
        _osm_graph = ox.graph_from_point(
            (settings.DEPOT_LATITUDE, settings.DEPOT_LONGITUDE),
            dist=25000,  # 25km radius
            network_type='drive'
        )
        # Add travel times for routing
        _osm_graph = ox.add_edge_speeds(_osm_graph)
        _osm_graph = ox.add_edge_travel_times(_osm_graph)
        _osm_graph_loaded = True
        print(f"OSM graph loaded: {len(_osm_graph.nodes)} nodes, {len(_osm_graph.edges)} edges")
        return _osm_graph
    except Exception as e:
        print(f"Error loading OSM graph: {e}")
        _osm_graph_loaded = True  # Don't retry on error
        return None


def clear_osm_cache():
    """Clear the OSM graph cache to force reload."""
    global _osm_graph, _osm_graph_loaded
    _osm_graph = None
    _osm_graph_loaded = False


def route_to_depot(lat: float, lng: float) -> Optional[Dict]:
    """
    Route from a location to the depot using OSMnx.

    Returns dict with route data or None if failed.
    """
    graph = get_osm_graph()
    if graph is None:
        return None

    try:
        # Find nearest nodes
        customer_node = ox.nearest_nodes(graph, lng, lat)
        depot_node = ox.nearest_nodes(graph, settings.DEPOT_LONGITUDE, settings.DEPOT_LATITUDE)

        # Calculate shortest route by travel time
        route_nodes = ox.shortest_path(graph, customer_node, depot_node, weight='travel_time')

        if not route_nodes:
            return None

        # Build route geometry and calculate stats
        coords = []
        total_distance = 0
        total_time = 0

        for i in range(len(route_nodes) - 1):
            u, v = route_nodes[i], route_nodes[i + 1]
            # Get node coordinates
            coords.append((graph.nodes[u]['x'], graph.nodes[u]['y']))

            # Get edge data
            edge_data = graph.get_edge_data(u, v)
            if edge_data:
                edge = edge_data[0] if isinstance(edge_data, dict) and 0 in edge_data else edge_data
                total_distance += edge.get('length', 0)
                total_time += edge.get('travel_time', 0)

        # Add last node
        last_node = route_nodes[-1]
        coords.append((graph.nodes[last_node]['x'], graph.nodes[last_node]['y']))

        # Create LineString geometry
        route_geom = LineString(coords)

        return {
            'geometry': route_geom,
            'distance_meters': int(total_distance),
            'duration_seconds': int(total_time),
        }

    except Exception as e:
        print(f"Error routing to depot: {e}")
        return None


def find_corridor(session: Session, route_geom: LineString) -> Tuple[Optional[int], Optional[str]]:
    """
    Find which major road the route uses most.
    Uses PostGIS ST_Intersects to find intersecting roads,
    then picks the one with longest intersection.

    Returns (major_road_id, corridor_ref) or (None, None) if no match.
    """
    # Convert shapely geometry to WKT for SQL
    route_wkt = route_geom.wkt

    # Query to find intersecting major roads, ordered by intersection length
    query = text("""
        SELECT
            id,
            ref,
            ST_Length(ST_Intersection(geom, ST_GeomFromText(:route_wkt, 4326))::geography) as intersection_length
        FROM major_roads
        WHERE ST_Intersects(geom, ST_GeomFromText(:route_wkt, 4326))
          AND is_active = true
        ORDER BY intersection_length DESC
        LIMIT 1
    """)

    result = session.execute(query, {'route_wkt': route_wkt}).fetchone()

    if result:
        return result[0], result[1]  # id, ref

    return None, None


def fetch_and_save_route(
    session: Session,
    user_id: int,
    lat: float,
    lng: float
) -> Optional[CustomerRoute]:
    """
    Route from customer to depot using OSMnx and save to database.
    Assigns corridor using PostGIS spatial intersection.
    """
    # Get route from OSMnx
    route_data = route_to_depot(lat, lng)

    if route_data is None:
        return None

    # Find corridor using PostGIS
    major_road_id, corridor = find_corridor(session, route_data['geometry'])

    # Check if route already exists
    existing = session.exec(
        select(CustomerRoute).where(CustomerRoute.user_id == user_id)
    ).first()

    if existing:
        # Update existing record
        existing.distance_meters = route_data['distance_meters']
        existing.duration_seconds = route_data['duration_seconds']
        existing.major_road_id = major_road_id
        existing.corridor = corridor
        existing.fetched_at = datetime.now(timezone.utc)
        # Update geometry using raw SQL (SQLModel doesn't handle geometry well)
        session.execute(
            text("UPDATE customer_routes SET geom = ST_GeomFromText(:wkt, 4326) WHERE id = :id"),
            {'wkt': route_data['geometry'].wkt, 'id': existing.id}
        )
        session.commit()
        session.refresh(existing)
        return existing
    else:
        # Create new record
        new_route = CustomerRoute(
            user_id=user_id,
            distance_meters=route_data['distance_meters'],
            duration_seconds=route_data['duration_seconds'],
            major_road_id=major_road_id,
            corridor=corridor,
        )
        session.add(new_route)
        session.commit()
        session.refresh(new_route)

        # Update geometry using raw SQL
        session.execute(
            text("UPDATE customer_routes SET geom = ST_GeomFromText(:wkt, 4326) WHERE id = :id"),
            {'wkt': route_data['geometry'].wkt, 'id': new_route.id}
        )
        session.commit()

        return new_route


def get_customer_route(session: Session, user_id: int) -> Optional[CustomerRoute]:
    """Get stored route for a customer."""
    return session.exec(
        select(CustomerRoute).where(CustomerRoute.user_id == user_id)
    ).first()


def get_all_customer_routes(session: Session) -> List[CustomerRoute]:
    """Get all stored customer routes."""
    return session.exec(select(CustomerRoute)).all()


def get_routes_by_corridor(session: Session, corridor: str) -> List[CustomerRoute]:
    """Get all routes in a specific corridor."""
    return session.exec(
        select(CustomerRoute).where(CustomerRoute.corridor == corridor)
    ).all()


def delete_customer_route(session: Session, user_id: int) -> bool:
    """Delete a customer's route."""
    route = session.exec(
        select(CustomerRoute).where(CustomerRoute.user_id == user_id)
    ).first()

    if route:
        session.delete(route)
        session.commit()
        return True
    return False


def reassign_all_corridors(session: Session) -> Dict:
    """
    Reassign corridors for all existing customer routes.
    Uses PostGIS to find which major road each route intersects.
    """
    routes = session.exec(select(CustomerRoute)).all()

    if not routes:
        return {'total_routes': 0, 'updated': 0, 'by_corridor': {}}

    updated = 0
    corridor_counts = {}

    for route in routes:
        # Get route geometry
        result = session.execute(
            text("SELECT ST_AsText(geom) FROM customer_routes WHERE id = :id"),
            {'id': route.id}
        ).fetchone()

        if result and result[0]:
            from shapely import wkt
            route_geom = wkt.loads(result[0])

            # Find corridor
            new_road_id, new_corridor = find_corridor(session, route_geom)

            if route.corridor != new_corridor or route.major_road_id != new_road_id:
                route.corridor = new_corridor
                route.major_road_id = new_road_id
                session.add(route)
                updated += 1

            corridor_name = new_corridor or 'UNKNOWN'
            corridor_counts[corridor_name] = corridor_counts.get(corridor_name, 0) + 1

    session.commit()

    return {
        'total_routes': len(routes),
        'updated': updated,
        'by_corridor': corridor_counts
    }


def get_all_corridors(session: Session) -> List[Dict]:
    """Get all corridors from the major_roads table."""
    roads = session.exec(
        select(MajorRoad).where(MajorRoad.is_active == True)
    ).all()

    return [
        {
            'id': road.id,
            'ref': road.ref,
            'name': road.name,
            'highway_type': road.highway_type,
            'length_km': road.length_km,
            'color': road.color,
        }
        for road in roads
    ]


def clear_corridor_cache():
    """No cache to clear in new implementation."""
    pass
