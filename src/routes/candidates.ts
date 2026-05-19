import { FastifyInstance } from 'fastify';
import { Candidate } from '../types/candidate';
import {  getDB } from '../config/database';

type CandidateConnectorStats = {
  _id: string;
  total: number;
  afters: Array<{ value: string; count: number }>;
};

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

  fastify.get<{
    Reply: {
      data: Array<{
        _id: string;
        total: number;
        afters: Array<{ value: string; count: number }>;
      }>;
    };
  }>('/candidates/stats/by-connector', async () => {
    const db = getDB();
    const collection = db.collection<Candidate>('candidates');
  
    const stats = await collection
      .aggregate<CandidateConnectorStats>([
        {
          $group: {
            _id: { connector: '$connector_family', after: '$context.after' },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.connector',
            total: { $sum: '$count' },
            afters: {
              $push: {
                value: '$_id.after',
                count: '$count'
              }
            }
          }
        },
        {
          $sort: { total: -1 }
        }
      ])
      .toArray();
  
    return { data: stats };
  });
}
