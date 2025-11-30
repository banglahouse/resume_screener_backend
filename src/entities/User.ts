import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'external_id', unique: true })
  externalId: string;

  @Column({ type: 'varchar', length: 20 })
  role: 'recruiter' | 'candidate';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}