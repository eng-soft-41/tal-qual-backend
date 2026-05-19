import 'dotenv/config';
import { readFile } from 'fs/promises';
import path from 'path';
import { AnyBulkWriteOperation, Collection, Document } from 'mongodb';
import { connectDB, client } from '../config/database';
import {
  comparisonCollections,
  COMPARISON_DATASET_VERSION,
  ComparisonCandidate,
} from '../types/comparison';
import {
  comparisonCandidateSchema,
  comparisonCountSchema,
  comparisonExampleSchema,
  comparisonManifestSchema,
} from '../schemas/comparison';

const requiredFiles = [
  'candidates.jsonl',
  'ground_vehicle_counts.json',
  'vehicle_ground_counts.json',
  'ground_counts.json',
  'vehicle_counts.json',
  'examples.jsonl',
  'manifest.json',
] as const;

type CountMap = Record<string, number>;
type PairKey = 'ground_vehicle' | 'vehicle_ground';

async function readJsonFile<T>(exportDir: string, fileName: string): Promise<T> {
  const content = await readFile(path.join(exportDir, fileName), 'utf8');
  return JSON.parse(content) as T;
}

async function readJsonLines<T>(exportDir: string, fileName: string): Promise<T[]> {
  const content = await readFile(path.join(exportDir, fileName), 'utf8');
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as T;
      } catch (error) {
        throw new Error(`Invalid JSON in ${fileName}:${index + 1}`);
      }
    });
}

async function assertRequiredFiles(exportDir: string) {
  const missing: string[] = [];

  await Promise.all(
    requiredFiles.map(async (fileName) => {
      try {
        await readFile(path.join(exportDir, fileName));
      } catch {
        missing.push(fileName);
      }
    }),
  );

  if (missing.length > 0) {
    throw new Error(`Missing required export files: ${missing.sort().join(', ')}`);
  }
}

function withImportMetadata<T extends Document>(
  record: T,
  importedAt: Date,
  datasetVersion: string,
): T {
  return {
    ...record,
    dataset_version: datasetVersion,
    importedAt,
  };
}

function parsePairKey(key: string, pairKey: PairKey): Record<string, string> {
  const [first, ...rest] = key.split('|||');
  const second = rest.join('|||');

  if (!first || !second) {
    throw new Error(`Cannot normalize aggregate map key "${key}"`);
  }

  if (pairKey === 'ground_vehicle') {
    return {
      ground_lemma: first,
      vehicle_head_clean_lemma: second,
    };
  }

  return {
    vehicle_head_clean_lemma: first,
    ground_lemma: second,
  };
}

function normalizeCountRows(
  rows: unknown,
  importedAt: Date,
  datasetVersion: string,
  fallbackKey: string | PairKey,
): Document[] {
  const asRows = Array.isArray(rows)
    ? rows
    : Object.entries(rows as CountMap).map(([key, count]) => {
        const normalizedKey =
          fallbackKey === 'ground_vehicle' || fallbackKey === 'vehicle_ground'
            ? parsePairKey(key, fallbackKey)
            : { [fallbackKey]: key };

        return {
          ...normalizedKey,
          count,
        };
      });

  return asRows.map((row, index) => {
    const parsed = comparisonCountSchema.safeParse(row);

    if (!parsed.success) {
      throw new Error(`Invalid count row at index ${index}: ${parsed.error.message}`);
    }

    const normalized = { ...parsed.data };

    if (
      (fallbackKey === 'ground_vehicle' || fallbackKey === 'vehicle_ground') &&
      typeof normalized.visualization_ready !== 'boolean'
    ) {
      normalized.visualization_ready = true;
    }

    return withImportMetadata(normalized, importedAt, datasetVersion);
  });
}

function getManifestExpectedCount(manifest: Record<string, unknown>, key: string) {
  const value = manifest[key];
  return typeof value === 'number' ? value : undefined;
}

function assertManifestCount(
  manifest: Record<string, unknown>,
  key: string,
  actual: number,
) {
  const expected = getManifestExpectedCount(manifest, key);

  if (expected !== undefined && expected !== actual) {
    throw new Error(`Manifest count mismatch for ${key}: expected ${expected}, imported ${actual}`);
  }
}

async function replaceCollectionForDataset(
  collection: Collection,
  datasetVersion: string,
  rows: Document[],
) {
  await collection.deleteMany({ dataset_version: datasetVersion });

  if (rows.length > 0) {
    await collection.insertMany(rows);
  }
}

async function createIndexes(db: Awaited<ReturnType<typeof connectDB>>) {
  await Promise.all([
    db.collection(comparisonCollections.manifests).createIndexes([
      { key: { dataset_version: 1 }, unique: true, name: 'dataset_version_unique' },
      { key: { importedAt: -1 }, name: 'imported_at_desc' },
    ]),
    db.collection(comparisonCollections.candidates).createIndexes([
      {
        key: { dataset_version: 1, candidate_id: 1 },
        unique: true,
        name: 'dataset_candidate_unique',
      },
      { key: { dataset_version: 1, visualization_ready: 1 }, name: 'dataset_visualization_ready' },
      { key: { dataset_version: 1, ground_lemma: 1 }, name: 'dataset_ground' },
      {
        key: { dataset_version: 1, vehicle_head_clean_lemma: 1 },
        name: 'dataset_vehicle_head_clean',
      },
      {
        key: { dataset_version: 1, ground_lemma: 1, vehicle_head_clean_lemma: 1 },
        name: 'dataset_ground_vehicle',
      },
      {
        key: { dataset_version: 1, visualization_ready: 1, confidence: -1, candidate_id: 1 },
        name: 'dataset_ready_confidence_candidate',
      },
    ]),
    db.collection(comparisonCollections.groundVehicleCounts).createIndexes([
      { key: { dataset_version: 1, ground_lemma: 1, count: -1 }, name: 'dataset_ground_count' },
      {
        key: { dataset_version: 1, vehicle_head_clean_lemma: 1, count: -1 },
        name: 'dataset_vehicle_count',
      },
      {
        key: { dataset_version: 1, visualization_ready: 1, count: -1 },
        name: 'dataset_ready_count',
      },
    ]),
    db.collection(comparisonCollections.vehicleGroundCounts).createIndexes([
      {
        key: { dataset_version: 1, vehicle_head_clean_lemma: 1, count: -1 },
        name: 'dataset_vehicle_count',
      },
      { key: { dataset_version: 1, ground_lemma: 1, count: -1 }, name: 'dataset_ground_count' },
    ]),
    db.collection(comparisonCollections.groundCounts).createIndex(
      { dataset_version: 1, count: -1 },
      { name: 'dataset_count' },
    ),
    db.collection(comparisonCollections.vehicleCounts).createIndex(
      { dataset_version: 1, count: -1 },
      { name: 'dataset_count' },
    ),
    db.collection(comparisonCollections.examples).createIndexes([
      {
        key: { dataset_version: 1, visualization_ready: 1, confidence: -1, candidate_id: 1 },
        name: 'dataset_ready_confidence_candidate',
      },
      {
        key: { dataset_version: 1, ground_lemma: 1, vehicle_head_clean_lemma: 1 },
        name: 'dataset_ground_vehicle',
      },
    ]),
  ]);
}

async function importComparisons(exportDir: string) {
  await assertRequiredFiles(exportDir);

  const importedAt = new Date();
  const db = await connectDB();
  const manifestInput = await readJsonFile<Record<string, unknown>>(exportDir, 'manifest.json');
  const manifest = comparisonManifestSchema.parse(manifestInput);
  const datasetVersion =
    typeof manifest.dataset_version === 'string' ? manifest.dataset_version : COMPARISON_DATASET_VERSION;

  if (datasetVersion !== COMPARISON_DATASET_VERSION) {
    throw new Error(`Unsupported comparison dataset_version "${datasetVersion}"`);
  }

  const candidateRows = await readJsonLines<Record<string, unknown>>(exportDir, 'candidates.jsonl');
  const candidates = candidateRows.map((row, index) => {
    const parsed = comparisonCandidateSchema.safeParse({
      ...row,
      dataset_version: datasetVersion,
    });

    if (!parsed.success) {
      throw new Error(`Invalid candidate at candidates.jsonl:${index + 1}: ${parsed.error.message}`);
    }

    return withImportMetadata(parsed.data, importedAt, datasetVersion) as ComparisonCandidate;
  });
  const candidatesById = new Map(candidates.map((candidate) => [candidate.candidate_id, candidate]));

  const examples = (await readJsonLines<Record<string, unknown>>(exportDir, 'examples.jsonl')).map(
    (row, index) => {
      const parsed = comparisonExampleSchema.safeParse(row);

      if (!parsed.success) {
        throw new Error(`Invalid example at examples.jsonl:${index + 1}: ${parsed.error.message}`);
      }

      const candidateId = typeof parsed.data.candidate_id === 'string' ? parsed.data.candidate_id : undefined;
      const matchingCandidate = candidateId ? candidatesById.get(candidateId) : undefined;

      return withImportMetadata(
        {
          ...(matchingCandidate ?? {}),
          ...parsed.data,
        },
        importedAt,
        datasetVersion,
      );
    },
  );

  const groundVehicleCounts = normalizeCountRows(
    await readJsonFile(exportDir, 'ground_vehicle_counts.json'),
    importedAt,
    datasetVersion,
    'ground_vehicle',
  );
  const vehicleGroundCounts = normalizeCountRows(
    await readJsonFile(exportDir, 'vehicle_ground_counts.json'),
    importedAt,
    datasetVersion,
    'vehicle_ground',
  );
  const groundCounts = normalizeCountRows(
    await readJsonFile(exportDir, 'ground_counts.json'),
    importedAt,
    datasetVersion,
    'ground_lemma',
  );
  const vehicleCounts = normalizeCountRows(
    await readJsonFile(exportDir, 'vehicle_counts.json'),
    importedAt,
    datasetVersion,
    'vehicle_head_clean_lemma',
  );

  assertManifestCount(manifest, 'candidate_count', candidates.length);
  assertManifestCount(manifest, 'ground_vehicle_pair_count', groundVehicleCounts.length);
  assertManifestCount(manifest, 'ground_count', groundCounts.length);
  assertManifestCount(manifest, 'vehicle_count', vehicleCounts.length);
  assertManifestCount(
    manifest,
    'visualization_ready_count',
    candidates.filter((candidate) => candidate.visualization_ready).length,
  );
  assertManifestCount(manifest, 'example_count', examples.length);
  assertManifestCount(manifest, 'vehicle_ground_pair_count', vehicleGroundCounts.length);

  await db.collection(comparisonCollections.manifests).replaceOne(
    { dataset_version: datasetVersion },
    withImportMetadata(manifest, importedAt, datasetVersion),
    { upsert: true },
  );

  const candidateOps: AnyBulkWriteOperation<ComparisonCandidate>[] = candidates.map((candidate) => ({
    updateOne: {
      filter: {
        dataset_version: datasetVersion,
        candidate_id: candidate.candidate_id,
      },
      update: { $set: candidate },
      upsert: true,
    },
  }));

  if (candidateOps.length > 0) {
    await db.collection<ComparisonCandidate>(comparisonCollections.candidates).bulkWrite(candidateOps);
  }

  await Promise.all([
    replaceCollectionForDataset(
      db.collection(comparisonCollections.groundVehicleCounts),
      datasetVersion,
      groundVehicleCounts,
    ),
    replaceCollectionForDataset(
      db.collection(comparisonCollections.vehicleGroundCounts),
      datasetVersion,
      vehicleGroundCounts,
    ),
    replaceCollectionForDataset(
      db.collection(comparisonCollections.groundCounts),
      datasetVersion,
      groundCounts,
    ),
    replaceCollectionForDataset(
      db.collection(comparisonCollections.vehicleCounts),
      datasetVersion,
      vehicleCounts,
    ),
    replaceCollectionForDataset(
      db.collection(comparisonCollections.examples),
      datasetVersion,
      examples,
    ),
  ]);

  await createIndexes(db);

  return {
    dataset_version: datasetVersion,
    candidate_count: candidates.length,
    visualization_ready_count: candidates.filter((candidate) => candidate.visualization_ready).length,
    ground_count: groundCounts.length,
    vehicle_count: vehicleCounts.length,
    ground_vehicle_pair_count: groundVehicleCounts.length,
    vehicle_ground_pair_count: vehicleGroundCounts.length,
    example_count: examples.length,
    importedAt: importedAt.toISOString(),
  };
}

async function main() {
  const exportDir = process.argv[2];

  if (!exportDir) {
    throw new Error('Usage: npm run import:comparisons -- <export-dir>');
  }

  try {
    const counts = await importComparisons(path.resolve(exportDir));
    console.log('Comparison dataset import completed:', counts);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
