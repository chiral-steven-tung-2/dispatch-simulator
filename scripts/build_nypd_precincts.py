#!/usr/bin/env python3
"""
Builds src/data/nypdPrecincts.json from NYC DCP's "Police Precincts" dataset,
simplified and tagged with each feature's NypdStation id (matching the slug
produced by DispatchData.Slugify in the C# backend).

Source: https://data.cityofnewyork.us/resource/y76i-bdw7.geojson
Re-run this script if nypd_stations.csv precincts ever change.
"""

import csv
import json
import math
import os
import re
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIONS_CSV = os.path.join(ROOT, "server", "NycDispatch.Api", "Data", "nypd_stations.csv")
OUT_JSON = os.path.join(ROOT, "src", "data", "nypdPrecincts.json")
SOURCE_URL = "https://data.cityofnewyork.us/resource/y76i-bdw7.geojson?$limit=1000"

# Round coordinates to this many decimal places (~1.1m at NYC's latitude).
COORD_PRECISION = 5

# Douglas-Peucker tolerance in degrees (~10-20m), applied per ring.
SIMPLIFY_EPSILON = 0.00015

# Special-cased precinct numbers whose station names don't end in "Nth Precinct".
SPECIAL_PRECINCT_NUMBERS = {
    "14": "Midtown South Precinct",
    "18": "Midtown North Precinct",
    "22": "Central Park Precinct",
}


def slugify(value: str) -> str:
    """Mirrors DispatchData.Slugify in server/NycDispatch.Api/Data/DispatchData.cs."""
    out = []
    previous_dash = False
    for c in value.strip().lower():
        if c.isalnum():
            out.append(c)
            previous_dash = False
        elif not previous_dash:
            out.append("-")
            previous_dash = True
    return "".join(out).strip("-")


def load_precinct_to_station_id() -> dict:
    mapping = {}
    with open(STATIONS_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = row["name"].strip()
            slug = slugify(name)
            match = re.match(r"^(\d+)(?:st|nd|rd|th) Precinct$", name)
            if match:
                mapping[match.group(1)] = slug
                continue
            for number, special_name in SPECIAL_PRECINCT_NUMBERS.items():
                if name == special_name:
                    mapping[number] = slug
                    break
    return mapping


def fetch_raw_geojson() -> dict:
    cache_path = os.path.join(ROOT, "scripts", ".cache", "precincts_raw.geojson")
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    if os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as f:
            return json.load(f)
    with urllib.request.urlopen(SOURCE_URL) as resp:
        data = json.load(resp)
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(data, f)
    return data


def perpendicular_distance(point, start, end):
    (x, y), (x1, y1), (x2, y2) = point, start, end
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x - x1, y - y1)
    t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)
    proj_x, proj_y = x1 + t * dx, y1 + t * dy
    return math.hypot(x - proj_x, y - proj_y)


def douglas_peucker(points, epsilon):
    if len(points) < 3:
        return points
    start, end = points[0], points[-1]
    max_dist = -1.0
    index = 0
    for i in range(1, len(points) - 1):
        dist = perpendicular_distance(points[i], start, end)
        if dist > max_dist:
            max_dist = dist
            index = i
    if max_dist > epsilon:
        left = douglas_peucker(points[: index + 1], epsilon)
        right = douglas_peucker(points[index:], epsilon)
        return left[:-1] + right
    return [start, end]


def simplify_ring(ring):
    simplified = douglas_peucker(ring, SIMPLIFY_EPSILON)
    if len(simplified) < 4:
        return ring
    return simplified


def round_coord(coord):
    return [round(coord[0], COORD_PRECISION), round(coord[1], COORD_PRECISION)]


def process_geometry(geometry):
    if geometry["type"] == "Polygon":
        rings = geometry["coordinates"]
    elif geometry["type"] == "MultiPolygon":
        rings = [ring for polygon in geometry["coordinates"] for ring in polygon]
    else:
        raise ValueError(f"Unsupported geometry type: {geometry['type']}")

    if geometry["type"] == "Polygon":
        return {
            "type": "Polygon",
            "coordinates": [
                [round_coord(c) for c in simplify_ring(ring)] for ring in geometry["coordinates"]
            ],
        }

    return {
        "type": "MultiPolygon",
        "coordinates": [
            [[round_coord(c) for c in simplify_ring(ring)] for ring in polygon]
            for polygon in geometry["coordinates"]
        ],
    }


def main():
    precinct_to_station = load_precinct_to_station_id()
    raw = fetch_raw_geojson()

    features = []
    skipped = []
    for feature in raw["features"]:
        precinct = feature["properties"]["precinct"]
        station_id = precinct_to_station.get(precinct)
        if station_id is None:
            skipped.append(precinct)
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {"stationId": station_id, "precinct": precinct},
                "geometry": process_geometry(feature["geometry"]),
            }
        )

    out = {"type": "FeatureCollection", "features": features}
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUT_JSON) / 1024
    print(f"Wrote {len(features)} precincts ({size_kb:.0f} KB) to {OUT_JSON}")
    if skipped:
        print(f"Skipped {len(skipped)} unmapped precinct numbers: {skipped}")


if __name__ == "__main__":
    main()
