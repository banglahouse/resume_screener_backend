import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './User';

@Entity({ name: 'jobs' })
@Unique(['recruiter', 'jobKey'])
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recruiter_user_id' })
  recruiter: User;

  @Column({ name: 'job_key' })
  jobKey: string;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ name: 'jd_text', type: 'text' })
  jdText: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
