# Comparison Dataset API

## Goal

Import and expose the backend-ready comparison dataset produced by the
`tal-qual` data project.

The backend should not run Spark, parse notebooks, or read Spark `part-*`
directories. It should consume the versioned export directory:

```text
../tal-qual/data/export/backend/comparisons/v1/
```

## Input Contract

Required input files:

```text
candidates.jsonl
ground_vehicle_counts.json
vehicle_ground_counts.json
ground_counts.json
vehicle_counts.json
examples.jsonl
manifest.json
```

The import job should fail fast if any required file is missing.

## Mongo Collections

Use dedicated collections for comparison data:

```text
comparison_manifests
comparison_candidates
comparison_ground_vehicle_counts
comparison_vehicle_ground_counts
comparison_ground_counts
comparison_vehicle_counts
comparison_examples
```

Each document should include:

```text
dataset_version
importedAt
```

Use `dataset_version = "v1"` for the first import.

## Candidate Type

Add a new `ComparisonCandidate` type rather than extending the existing generic
`Candidate` type.

Required fields:

```ts
export interface ComparisonCandidate {
  _id?: ObjectId;
  candidate_id: string;
  dataset_version: string;
  pattern_type: 'como_article_ground_vehicle';
  connector_text: string;
  candidate_full_text: string;
  text_before: string;
  tenor_text: string;
  tenor_lemma: string;
  tenor_confidence: string;
  ground_text: string;
  ground_lemma: string;
  ground_type: 'quality_adjective' | 'salient_verb';
  ground_source: string;
  vehicle_text_raw: string;
  vehicle_text_clean: string;
  vehicle_tail_text: string;
  vehicle_cleaning_rule: string;
  vehicle_lemma: string;
  vehicle_head: string;
  vehicle_head_lemma: string;
  vehicle_head_clean: string;
  vehicle_head_clean_lemma: string;
  vehicle_phrase_length_tokens: number;
  quality_label: 'keep' | 'trimmed' | 'review' | 'reject';
  quality_reason: string[];
  visualization_ready: boolean;
  confidence: number;
  needs_review: boolean;
  source_file: string;
  original_line_id: number;
  segment_id: number;
  char_start: number;
  char_end: number;
  connector_start: number;
  connector_end: number;
  vehicle_start: number;
  vehicle_end: number;
  importedAt?: Date;
}
```

## Import Command

Add a script:

```text
npm run import:comparisons -- ../tal-qual/data/export/backend/comparisons/v1
```

Behavior:

1. Load and validate `manifest.json`.
2. Load JSON/JSONL files from the provided export directory.
3. Validate records with Zod.
4. Upsert by `{ dataset_version, candidate_id }` for candidates.
5. Replace aggregate collections for the imported `dataset_version`.
6. Create indexes after import.
7. Print imported counts and fail if they do not match the manifest.

Recommended package script:

```json
{
  "scripts": {
    "import:comparisons": "ts-node src/scripts/importComparisons.ts"
  }
}
```

## Indexes

Create indexes:

```ts
comparison_candidates:
  { dataset_version: 1, candidate_id: 1 }, unique
  { dataset_version: 1, visualization_ready: 1 }
  { dataset_version: 1, ground_lemma: 1 }
  { dataset_version: 1, vehicle_head_clean_lemma: 1 }
  { dataset_version: 1, ground_lemma: 1, vehicle_head_clean_lemma: 1 }

comparison_ground_vehicle_counts:
  { dataset_version: 1, ground_lemma: 1, count: -1 }
  { dataset_version: 1, vehicle_head_clean_lemma: 1, count: -1 }

comparison_ground_counts:
  { dataset_version: 1, count: -1 }

comparison_vehicle_counts:
  { dataset_version: 1, count: -1 }
```

## API Routes

Add routes under:

```text
/comparisons
```

### `GET /comparisons/manifest`

Returns the active manifest.

Query:

```text
dataset_version?: string
```

### `GET /comparisons/pairs`

Returns ground -> vehicle pair counts.

Query:

```text
dataset_version?: string
ground?: string
vehicle?: string
limit?: number
offset?: number
visualization_ready?: boolean
```

Default:

```text
limit = 100
dataset_version = latest manifest version
visualization_ready = true
```

### `GET /comparisons/grounds`

Returns ground summary rows sorted by count desc.

Query:

```text
dataset_version?: string
limit?: number
offset?: number
```

### `GET /comparisons/vehicles`

Returns vehicle summary rows sorted by count desc.

Query:

```text
dataset_version?: string
limit?: number
offset?: number
```

### `GET /comparisons/examples`

Returns candidate examples.

Query:

```text
dataset_version?: string
ground?: string
vehicle?: string
quality_label?: string
visualization_ready?: boolean
limit?: number
offset?: number
```

Default sort:

```text
confidence desc, candidate_id asc
```

### `GET /comparisons/candidates/:candidateId`

Returns one candidate by id.

## Response Shape

All list routes should return:

```json
{
  "data": [],
  "meta": {
    "dataset_version": "v1",
    "limit": 100,
    "offset": 0,
    "total": 2136
  }
}
```

Single-record routes should return:

```json
{
  "data": {}
}
```

## Validation And Error Handling

- Unknown `dataset_version`: return `404`.
- Invalid query params: return `400`.
- `limit` maximum: `500`.
- Missing import files: import command exits non-zero.
- Manifest count mismatch: import command exits non-zero.

## Implementation Tasks

1. Add comparison TypeScript interfaces.
2. Add Zod schemas for import files and route queries.
3. Add JSONL reader utility.
4. Add `src/scripts/importComparisons.ts`.
5. Add Mongo indexes for comparison collections.
6. Add `src/routes/comparisons.ts`.
7. Register comparison routes in `src/server.ts`.
8. Add `npm run import:comparisons`.
9. Build with `npm run build`.
10. Smoke-test import and the main GET routes against local Mongo.

## Acceptance Criteria

- `npm run build` passes.
- Importing the v1 export directory creates all comparison collections.
- Imported counts match `manifest.json`.
- `GET /comparisons/manifest` returns the active dataset version.
- `GET /comparisons/pairs?ground=forte` returns repeated vehicle counts.
- `GET /comparisons/examples?ground=forte&vehicle=touro` returns source
  examples with `candidate_full_text`.
- Existing `/candidates` routes continue to work unchanged.
