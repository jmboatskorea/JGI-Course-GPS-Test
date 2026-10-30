#!/usr/bin/env python3
"""Build the three original Emeralda nines from the user's verified package.

Only package values become scoring data. Secondary candidates are never promoted.
Run with an extracted package directory and optional --source-zip for its exact hash.
"""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path


COURSES = (("River", 22976), ("Lake", 22977), ("Plantation", 22978))
TYPES = {"HoleBoundry": "H", "FairwayTrace": "F", "GreenTrace": "G",
         "BunkerTrace": "B", "WaterTrace": "W", "TeeboxTrace": "T"}
TEES = ("Gold", "Black", "Blue", "White", "Red")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def point(value):
    require(isinstance(value, dict), "Missing source coordinate")
    values = [value.get("latitude"), value.get("longitude")]
    require(all(type(v) in (int, float) and math.isfinite(v) and abs(v) <= limit
                for v, limit in zip(values, (90, 180))), "Invalid source coordinate")
    return values


def pointer(root, path):
    for part in path.strip("/").split("/"):
        root = root[int(part)] if isinstance(root, list) else root[part]
    return root


def verify_files(package):
    manifest = read_json(package / "SHA256.json")
    require(isinstance(manifest, dict) and manifest, "Missing package SHA256 manifest")
    for name, expected in manifest.items():
        path = (package / name).resolve()
        require(path.is_relative_to(package.resolve()), "Unsafe package manifest path")
        require(isinstance(expected, str) and len(expected) == 64 and
                all(c in "0123456789abcdef" for c in expected), "Invalid SHA256 manifest entry")
        require(path.is_file() and digest(path) == expected, "SHA256 mismatch: " + name)
    return manifest


def build(package, source_zip=None):
    hashes = verify_files(package)
    original = read_json(package / "raw/course-detail.original.json")
    decoded = read_json(package / "raw/course-detail.decoded.json")
    mappings = read_json(package / "all-holes-mapping.json")
    issues = read_json(package / "missing-and-conflicts.json")
    require(len(mappings) == 27 and len({m["holeId"] for m in mappings}) == 27,
            "Expected 27 distinct mapped Hole IDs")
    original_holes = {h["holeId"]: h for h in original["holes"]}
    nines, pooled, counts = [], [], []
    vertices_before = vertices_after = source_nulls = normalized_nulls = 0
    for name, course_id in COURSES:
        folder = package / "courses" / name.lower()
        gps = read_json(folder / "gps.original-records.json")
        rows = read_json(folder / "scorecard.json")
        mapping = read_json(folder / "mapping.json")
        expected = [m for m in mappings if m["courseId"] == course_id]
        require(canonical(mapping) == canonical(expected), "Per-nine mapping differs from verified mapping")
        require(gps["courseId"] == course_id and gps["course"] == name and len(mapping) == 9,
                "Invalid course mapping")
        require(sorted(m["holeNumber"] for m in mapping) == list(range(1, 10)), "Incomplete original nine")
        require(len(rows) == 9 and len({r["holeNumber"] for r in rows}) == 9, "Invalid scorecard rows")
        gps_holes = {h["holeId"]: h for h in gps["holes"]}
        require(set(gps_holes) == {m["holeId"] for m in mapping}, "GPS holes differ from mapping")
        by_number = {r["holeNumber"]: r for r in rows}
        records = gps["gpsItems"]
        require(all(r["holeId"] in gps_holes for r in records), "Orphan GPS record")
        pooled.extend(records)
        holes, card_holes, output_mapping = {}, {}, []
        unique_records, shape_count, unique_shape_count = set(), 0, 0
        for m in sorted(mapping, key=lambda x: x["holeNumber"]):
            number, hole_id = m["holeNumber"], m["holeId"]
            raw = original_holes[hole_id]
            require(m["course"] == name and m["courseId"] == course_id and
                    raw["holeNumber"] == number and raw["holeName"] == name + " #" + str(number),
                    "Source hole name/number mismatch")
            require(pointer(original, m["evidence"]["jsonPointer"]) == raw and
                    pointer(original, m["evidence"]["courseJsonPointer"])["courseId"] == course_id,
                    "Source mapping evidence mismatch")
            require(gps_holes[hole_id] == raw, "Source hole record changed")
            tee, green = point(m["teeGPSCoordinate"]), point(m["greenGPSCoordinate"])
            require(tee == point(raw["teeGPSCoordinate"]) and green == point(raw["greenGPSCoordinate"]),
                    "Mapped Tee/Green differs from original")
            own = [r for r in records if r["holeId"] == hole_id]
            require({r["gpsType"] for r in own} == set(TYPES), "Missing/unknown GPS type")
            shapes, seen_shapes = [], set()
            for record in own:
                unique_records.add(canonical(record))
                if record["gpsCoordinate"] is not None:
                    point(record["gpsCoordinate"])
                for ring in record["shapes"]:
                    require(len(ring) >= 3, "Incomplete source polygon")
                    coords = [point(p) for p in ring]
                    vertices_before += len(coords)
                    shape_count += 1
                    shape = [TYPES[record["gpsType"]], 0, coords]
                    key = canonical(shape)
                    if key in seen_shapes:
                        continue
                    seen_shapes.add(key)
                    shapes.append(shape)
                    vertices_after += len(coords)
                    unique_shape_count += 1
            holes[str(number)] = {"i": hole_id, "holeId": hole_id, "t": tee, "g": green, "s": shapes,
                                  "sourceCourseId": course_id, "sourceHoleNumber": number, "sourceNine": name}
            row = by_number[number]
            require(row["courseId"] == course_id and row["course"] == name and row["holeId"] == hole_id,
                    "Scorecard row ownership mismatch")
            values = row["values"]
            require(values["par"] in (None, 3, 4, 5), "Invalid source Par")
            handicap = values["handicap"]
            require(handicap is None or type(handicap) is int and 1 <= handicap <= 18,
                    "Invalid published source handicap")
            distances = {t: values["distancesMetres"][t] for t in TEES}
            require(all(v is None or type(v) in (int, float) and math.isfinite(v) and v > 0
                        for v in distances.values()), "Invalid source distance")
            # Generic nine-hole published allocation is not a verified sex/18-hole allocation.
            card = {"par": values["par"], "indexMen": None, "indexLadies": None,
                    **distances, "sourceHandicap": handicap, "status": row["status"], "source": row["source"],
                    "sourceCourseId": course_id, "sourceHoleNumber": number, "sourceNine": name}
            card_holes[str(number)] = card
            source_nulls += sum(v is None for v in (values["par"], handicap, *distances.values()))
            normalized_nulls += sum(card[k] is None for k in ("par", "indexMen", "indexLadies", *TEES))
            unresolved = [k for k in ("par", "indexMen", "indexLadies", *TEES) if card[k] is None]
            output_mapping.append({"courseId": course_id, "holeNumber": number, "holeId": hole_id,
                                   "tee": tee, "green": green, "mappingStatus": m["status"],
                                   "fieldValidated": False, "sourceEvidence": m["evidence"],
                                   "scorecardStatus": row["status"], "sourceHandicap": handicap,
                                   "unresolvedFields": unresolved})
        version_files = {str(p.relative_to(package)): hashes[str(p.relative_to(package))]
                         for p in (folder / "gps.original-records.json", folder / "mapping.json", folder / "scorecard.json")}
        version = "EMERALDA_GI_" + hashlib.sha256(canonical(version_files).encode()).hexdigest()
        data = {"courseId": course_id, "course": "Emeralda Golf Club", "nine": name,
                "source": "WORK_VERIFIED_GI_PACKAGE", "version": version, "holes": holes}
        tees = {t: {"label": t, "rating": None, "slope": None,
                    "total": sum(h[t] for h in card_holes.values()) if all(h[t] is not None for h in card_holes.values()) else None}
                for t in TEES}
        scorecard = {"courseId": course_id, "course": data["course"], "courseName": name,
                     "distanceUnit": "m", "source": "Verified package values only; historical status retained",
                     "tees": tees, "holes": card_holes}
        nines.append({"data": data, "scorecard": scorecard, "mapping": output_mapping})
        counts.append({"courseId": course_id, "nine": name, "holes": 9, "gpsRecords": len(records),
                       "uniqueGpsRecords": len(unique_records), "sourceShapes": shape_count,
                       "uniqueShapes": unique_shape_count, "scorecardStatuses": dict(collections.Counter(r["status"] for r in rows))})
    require(collections.Counter(map(canonical, pooled)) == collections.Counter(map(canonical, decoded)),
            "Per-nine GPS records differ from decoded original")
    lake_source = read_json(package / "sources/official-lake.indexed-scorecard.json")
    provenance = read_json(package / "sources/provenance.json")
    source = {"sourceZipSha256": digest(source_zip) if source_zip else None,
              "sourceZipFileName": source_zip.name if source_zip else None,
              "manifestSha256": digest(package / "SHA256.json"), "sourceFiles": hashes,
              "courseGroupId": original["courseGroupId"], "mappingValidation": "verified_from_GI_named_hole",
              "fieldValidated": False, "nines": counts, "holeCount": 27, "uniqueHoleIds": 27,
              "gpsRecords": len(pooled), "uniqueGpsRecords": sum(c["uniqueGpsRecords"] for c in counts),
              "coordinateVerticesOriginal": vertices_before, "coordinateVerticesGenerated": vertices_after,
              "geometryConversion": "latitude/longitude to packed [lat,lng]; exact per-hole duplicate shapes removed only; no simplification",
              "scorecardValuesPolicy": "values only; secondary candidates never promoted; generic handicap preserved as sourceHandicap only",
              "unresolvedCounts": {"sourceScorecardNullFields": source_nulls, "normalizedScorecardNullFields": normalized_nulls,
                                   "sexOrCombinedAllocationUnknown": 54, "officialSourceUnverifiedHoles": 18,
                                   "historicalIndexedOfficialHoles": 9},
              "provenance": {"packageReportedRetrievalDate": provenance.get("retrievedDate"),
                             "lakeOfficialIndexedSource": lake_source, "dataDates": read_json(package / "validation.json")["dataDates"]},
              "issues": issues}
    return nines, source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", type=Path)
    parser.add_argument("--source-zip", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "emeralda-course-data.js")
    args = parser.parse_args()
    nines, source = build(args.package.resolve(), args.source_zip)
    output = ("// Emeralda original nines: verified source mapping; no inferred scorecard values.\n"
              "window.JGI_EMERALDA_NINES=" + json.dumps(nines, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + ";\n"
              "window.JGI_EMERALDA_SOURCE=" + json.dumps(source, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + ";\n")
    args.output.write_text(output, encoding="utf-8")
    print(json.dumps({"output": str(args.output), "sha256": digest(args.output), "nines": 3, "holes": 27,
                      "gpsRecords": source["gpsRecords"], "uniqueGpsRecords": source["uniqueGpsRecords"],
                      "unresolvedCounts": source["unresolvedCounts"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
