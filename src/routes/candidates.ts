import { FastifyInstance } from 'fastify';
import { Candidate } from '../types/candidate';
import { connectDB, getDB } from '../config/database';

export async function candidateRoutes(fastify: FastifyInstance) {

    fastify.get<{ Reply: { data: Candidate[] } }>('/candidates', async (request, reply) => {
    const db = getDB();
    const collection = db.collection<Candidate>('candidates');
    const candidates = await collection.find({}).toArray();
    return { data: candidates };
  });

  fastify.get<{ 
    Querystring: {
      label?: string;
      connector_family?: string;
    };
    Reply: { data: Candidate[] }
  }>('/candidates/search', async (request, reply) => {
    const db = getDB();
    const collection = db.collection<Candidate>('candidates');

    const filter: Record<string, any> = {};

    if (request.query.label) {
      filter.label = request.query.label;
    }
    if (request.query.connector_family) {
      filter.connector_family = request.query.connector_family;
    }

    const candidates = await collection.find(filter).toArray();
    return { data: candidates };
  });

}