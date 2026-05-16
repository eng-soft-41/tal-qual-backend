import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  MONGO_URI: z.string().min(1, 'DATABASE é obrigatório'),
  DATABASE: z.string().min(1, 'DATABASE é obrigatório'),
})

const _env = envSchema.safeParse(process.env)

if (_env.success === false) {
  console.error('Invalid environment variables', _env.error.format())

  throw new Error('Invalid environment variables')
}

export const env = _env.data