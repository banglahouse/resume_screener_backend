import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from './logger';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY
});

export async function embedText(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: text
    });

    return response.data[0].embedding;
  } catch (error) {
    logger.error('Failed to generate embedding', error);
    throw new Error('Embedding service unavailable, try again later');
  }
}

export async function embedMany(texts: string[]): Promise<number[][]> {
  try {
    const response = await openai.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: texts
    });

    return response.data.map(item => item.embedding);
  } catch (error) {
    logger.error('Failed to generate embeddings', error);
    throw new Error('Embedding service unavailable, try again later');
  }
}