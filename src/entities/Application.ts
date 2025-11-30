import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Job } from './Job';
import { Resume } from './Resume';

@Entity({ name: 'applications' })
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Job)
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @ManyToOne(() => Resume)
  @JoinColumn({ name: 'resume_id' })
  resume: Resume;

  @Column({ name: 'match_score', type: 'numeric', precision: 5, scale: 2, nullable: true })
  matchScore: number | null;

  @Column({ type: 'jsonb', nullable: true })
  strengths: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  gaps: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  insights: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}