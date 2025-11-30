import dotenv from 'dotenv';

dotenv.config();

interface EnvConfig {
  PORT: number;
  DATABASE_URL: string;
  OPENAI_API_KEY: string;
  NODE_ENV: string;
  OPENAI_EMBEDDING_MODEL: string;
}

function validateEnv(): EnvConfig {
  const requiredEnvVars = ['DATABASE_URL', 'OPENAI_API_KEY'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    PORT: parseInt(process.env.PORT || '3000', 10),
    DATABASE_URL: process.env.DATABASE_URL!,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    NODE_ENV: process.env.NODE_ENV || 'development',
    OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
  };
}

export const env = validateEnv();