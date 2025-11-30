import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './env';
import { User } from '../entities/User';
import { Job } from '../entities/Job';
import { Resume } from '../entities/Resume';
import { Application } from '../entities/Application';
import { JobChunk } from '../entities/JobChunk';
import { ResumeChunk } from '../entities/ResumeChunk';
import { ChatMessage } from '../entities/ChatMessage';

const migrationsGlob = env.NODE_ENV === 'production'
  ? 'dist/migrations/*.js'
  : 'migrations/*.ts';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [User, Job, Resume, Application, JobChunk, ResumeChunk, ChatMessage],
  migrations: [migrationsGlob],
  synchronize: false,
  logging: env.NODE_ENV === 'development'
});
