import { MongoClient, Db } from 'mongodb';
import { env } from './env';

const client = new MongoClient(env.MONGO_URI);
let db: Db;

export async function connectDB(): Promise<Db> {
  try {
    await client.connect();
    db = client.db(env.DATABASE);
    console.log('✅ MongoDB conectado');
    return db;
  } catch (error) {
    console.error('❌ Erro ao conectar MongoDB:', error);
    throw new Error('Erro ao instanciar mongodb');
  }
}

export function getDB(): Db {
  if (!db) {
    throw new Error('Banco de dados não inicializado. Chame connectDB() primeiro.');
  }
  return db;
}

export { client };