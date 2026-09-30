# GI Course Adapter (minimal scope)

Server/offline Node.js 20+ adapter. The existing Player HTML is unchanged.
No Google Maps integration, UI change, provider API request or deployment is included.

```sh
node scripts/convert-course.cjs /path/to/course-detail.txt .private/jagorawi-course.json
```

Accepts JSON or the supplied `Course Detail` text followed by JSON. The adapter:

- Decodes `data` as Base64 → GZIP → JSON, with 32 MiB limits.
- Groups geometry by course and `holeId` / `holeNumber`.
- Maps FairwayTrace / BunkerTrace / GreenTrace / TeeboxTrace / HoleBoundry / WaterTrace / WaterPath to FAIRWAY / BUNKER / GREEN / TEE / HOLE_BOUNDARY / WATER / WATER_PATH.
- Returns polygon paths and open WaterPath polylines as `{lat, lng}` arrays.
- Removes repeated records and identical shapes, including polygon start-point/winding differences. Coordinates are not rounded. Dedupe is scoped to hole and type.
- Skips invalid shapes and reports counts. Unknown types are counted rather than guessed.

`adaptCourseDetail(detail, {holeCourseIds})` in `server/gi-course-adapter.cjs` returns `{schemaVersion, publicId, name, updatedOn, courses, warnings, stats}`. Courses contain holes; holes contain `shapes` with `id`, `type`, `geometry` and `path`.

Tee records are used only to identify which course owns each hole. No scorecard conversion is included. When one remaining course has an exact, unique full set of hole numbers, ownership can be inferred by remainder with a warning. Ambiguous holes are left unassigned with warnings; callers can supply an explicit `holeCourseIds` mapping. No hole-ID arithmetic or array-position mapping is used.

Keep original provider responses and generated course data private. `.private/` and environment files are ignored. Only allowlisted geometry metadata is returned; secrets/tokens are neither requested nor copied. Never add provider credentials to frontend code or commit raw responses.

Jagorawi smoke check: Old and New each contain 18 holes. The input has 500 GPS records, of which 250 repeat exactly. After expanding paths, 2,464 valid shapes remain; 3 degenerate paths are skipped. Old course ownership is inferred by the guarded remainder rule. This is a data-reading check, not a map or on-course accuracy test.
