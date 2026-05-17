import { FastifyInstance } from 'fastify';
import { Filter, WithId } from 'mongodb';
import { getDB } from '../config/database';
import {
  comparisonBooleanQuery,
  comparisonQuerySchema,
} from '../schemas/comparison';
import {
  comparisonCollections,
  COMPARISON_DATASET_VERSION,
  ComparisonCandidate,
} from '../types/comparison';

type ListMeta = {
  dataset_version: string;
  limit: number;
  offset: number;
  total: number;
};

type ListResponse<T> = {
  data: T[];
  meta: ListMeta;
};

const pairQuerySchema = comparisonQuerySchema.extend({
  ground: comparisonQuerySchema.shape.dataset_version,
  vehicle: comparisonQuerySchema.shape.dataset_version,
  visualization_ready: comparisonBooleanQuery.optional().default(true),
});

const examplesQuerySchema = comparisonQuerySchema.extend({
  ground: comparisonQuerySchema.shape.dataset_version,
  vehicle: comparisonQuerySchema.shape.dataset_version,
  quality_label: comparisonQuerySchema.shape.dataset_version,
  visualization_ready: comparisonBooleanQuery.optional(),
});

async function resolveDatasetVersion(requested?: string) {
  if (requested) {
    return requested;
  }

  const db = getDB();
  const latestManifest = await db
    .collection(comparisonCollections.manifests)
    .find({})
    .sort({ importedAt: -1 })
    .limit(1)
    .next();

  return latestManifest?.dataset_version?.toString() ?? COMPARISON_DATASET_VERSION;
}

async function listCollection<T extends object>(
  collectionName: string,
  filter: Filter<T>,
  limit: number,
  offset: number,
  sort: Record<string, 1 | -1>,
  datasetVersion: string,
): Promise<ListResponse<WithId<T>>> {
  const db = getDB();
  const collection = db.collection<T>(collectionName);
  const [data, total] = await Promise.all([
    collection.find(filter).sort(sort).skip(offset).limit(limit).toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    data,
    meta: {
      dataset_version: datasetVersion,
      limit,
      offset,
      total,
    },
  };
}

export async function comparisonRoutes(fastify: FastifyInstance) {
  fastify.get('/comparisons/manifest', async (request) => {
    const query = comparisonQuerySchema.pick({ dataset_version: true }).parse(request.query);
    const datasetVersion = await resolveDatasetVersion(query.dataset_version);
    const db = getDB();
    const manifest = await db
      .collection(comparisonCollections.manifests)
      .findOne({ dataset_version: datasetVersion });

    return { data: manifest };
  });

  fastify.get('/comparisons/pairs', async (request) => {
    const query = pairQuerySchema.parse(request.query);
    const datasetVersion = await resolveDatasetVersion(query.dataset_version);
    const filter: Record<string, unknown> = {
      dataset_version: datasetVersion,
      visualization_ready: query.visualization_ready,
    };

    if (query.ground) {
      filter.ground_lemma = query.ground;
    }

    if (query.vehicle) {
      filter.vehicle_head_clean_lemma = query.vehicle;
    }

    return listCollection(
      comparisonCollections.groundVehicleCounts,
      filter,
      query.limit,
      query.offset,
      { count: -1 },
      datasetVersion,
    );
  });

  fastify.get('/comparisons/grounds', async (request) => {
    const query = comparisonQuerySchema.parse(request.query);
    const datasetVersion = await resolveDatasetVersion(query.dataset_version);

    return listCollection(
      comparisonCollections.groundCounts,
      { dataset_version: datasetVersion },
      query.limit,
      query.offset,
      { count: -1 },
      datasetVersion,
    );
  });

  fastify.get('/comparisons/vehicles', async (request) => {
    const query = comparisonQuerySchema.parse(request.query);
    const datasetVersion = await resolveDatasetVersion(query.dataset_version);

    return listCollection(
      comparisonCollections.vehicleCounts,
      { dataset_version: datasetVersion },
      query.limit,
      query.offset,
      { count: -1 },
      datasetVersion,
    );
  });

  fastify.get('/comparisons/examples', async (request) => {
    const query = examplesQuerySchema.parse(request.query);
    const datasetVersion = await resolveDatasetVersion(query.dataset_version);
    const filter: Record<string, unknown> = {
      dataset_version: datasetVersion,
    };

    if (query.ground) {
      filter.ground_lemma = query.ground;
    }

    if (query.vehicle) {
      filter.vehicle_head_clean_lemma = query.vehicle;
    }

    if (query.quality_label) {
      filter.quality_label = query.quality_label;
    }

    if (query.visualization_ready !== undefined) {
      filter.visualization_ready = query.visualization_ready;
    }

    return listCollection(
      comparisonCollections.examples,
      filter,
      query.limit,
      query.offset,
      { confidence: -1, candidate_id: 1 },
      datasetVersion,
    );
  });

  fastify.get<{
    Params: { candidateId: string };
  }>('/comparisons/candidates/:candidateId', async (request, reply) => {
    const datasetVersion = await resolveDatasetVersion(
      typeof request.query === 'object' && request.query
        ? (request.query as { dataset_version?: string }).dataset_version
        : undefined,
    );
    const db = getDB();
    const candidate = await db.collection<ComparisonCandidate>(comparisonCollections.candidates).findOne({
      dataset_version: datasetVersion,
      candidate_id: request.params.candidateId,
    });

    if (!candidate) {
      return reply.status(404).send({ message: 'Comparison candidate not found' });
    }

    return { data: candidate };
  });
}
