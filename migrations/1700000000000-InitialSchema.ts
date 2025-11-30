import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable extensions
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "vector"');

    // Create users table
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        external_id TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('recruiter','candidate')),
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Create jobs table
    await queryRunner.query(`
      CREATE TABLE jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        recruiter_user_id UUID NOT NULL REFERENCES users(id),
        job_key TEXT NOT NULL,
        title TEXT,
        jd_text TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE (recruiter_user_id, job_key)
      )
    `);

    // Create resumes table
    await queryRunner.query(`
      CREATE TABLE resumes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        candidate_user_id UUID REFERENCES users(id),
        raw_text TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Create applications table
    await queryRunner.query(`
      CREATE TABLE applications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        job_id UUID NOT NULL REFERENCES jobs(id),
        resume_id UUID NOT NULL REFERENCES resumes(id),
        match_score NUMERIC(5,2),
        strengths JSONB,
        gaps JSONB,
        insights JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Create job_chunks table
    await queryRunner.query(`
      CREATE TABLE job_chunks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        job_id UUID NOT NULL REFERENCES jobs(id),
        idx INT NOT NULL,
        content TEXT NOT NULL,
        embedding VECTOR(1536) NOT NULL
      )
    `);

    // Create resume_chunks table
    await queryRunner.query(`
      CREATE TABLE resume_chunks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        resume_id UUID NOT NULL REFERENCES resumes(id),
        idx INT NOT NULL,
        content TEXT NOT NULL,
        embedding VECTOR(1536) NOT NULL
      )
    `);

    // Create chat_messages table
    await queryRunner.query(`
      CREATE TABLE chat_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        application_id UUID NOT NULL REFERENCES applications(id),
        role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Create indexes
    await queryRunner.query('CREATE INDEX job_chunks_job_id_idx ON job_chunks(job_id)');
    await queryRunner.query('CREATE INDEX resume_chunks_resume_id_idx ON resume_chunks(resume_id)');
    await queryRunner.query('CREATE INDEX applications_job_id_idx ON applications(job_id)');
    await queryRunner.query('CREATE INDEX resumes_candidate_user_id_idx ON resumes(candidate_user_id)');
    await queryRunner.query('CREATE INDEX chat_messages_app_id_idx ON chat_messages(application_id)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS chat_messages');
    await queryRunner.query('DROP TABLE IF EXISTS resume_chunks');
    await queryRunner.query('DROP TABLE IF EXISTS job_chunks');
    await queryRunner.query('DROP TABLE IF EXISTS applications');
    await queryRunner.query('DROP TABLE IF EXISTS resumes');
    await queryRunner.query('DROP TABLE IF EXISTS jobs');
    await queryRunner.query('DROP TABLE IF EXISTS users');
    await queryRunner.query('DROP EXTENSION IF EXISTS "vector"');
    await queryRunner.query('DROP EXTENSION IF EXISTS "uuid-ossp"');
  }
}