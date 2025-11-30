import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Resume } from './Resume';

@Entity({ name: 'resume_chunks' })
export class ResumeChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Resume)
  @JoinColumn({ name: 'resume_id' })
  resume: Resume;

  @Column()
  idx: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'vector' as any })
  embedding: number[];
}