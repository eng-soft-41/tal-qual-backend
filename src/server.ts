import 'dotenv/config';
import fastify from 'fastify';
import { ZodError } from 'zod';
import { connectDB, client } from './config/database';
import { candidateRoutes } from './routes/candidates';
import { comparisonRoutes } from './routes/comparisons';
import { env } from './config/env';

export const app = fastify({ logger: true });

app.setErrorHandler((error, _, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: 'Validation error',
      issues: error.format(),
    });
  }

  return reply.status(500).send({
    message: 'Internal server error',
  });
});

async function start() {
  try {
    await connectDB();

    await app.register(candidateRoutes);
    await app.register(comparisonRoutes);

    const address = await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 Server listening on ${address}`);
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    await client.close();
    process.exit(1);
  }
}

start();
