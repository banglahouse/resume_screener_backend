import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Job } from './Job';

@Entity({ name: 'job_chunks' })
export class JobChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Job)
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @Column()
  idx: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'vector' as any })
  embedding: number[];
}