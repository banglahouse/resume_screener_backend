import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExtraSkillsColumn1700000000001 implements MigrationInterface {
  name = 'AddExtraSkillsColumn1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE applications ADD COLUMN extra_skills JSONB');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE applications DROP COLUMN extra_skills');
  }
}
