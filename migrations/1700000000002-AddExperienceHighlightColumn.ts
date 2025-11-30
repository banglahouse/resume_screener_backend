import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExperienceHighlightColumn1700000000002 implements MigrationInterface {
  name = 'AddExperienceHighlightColumn1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE applications ADD COLUMN experience_highlight TEXT');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE applications DROP COLUMN experience_highlight');
  }
}
