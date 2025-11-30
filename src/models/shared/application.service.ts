import { AppDataSource } from '../../config/data-source';
import { User } from '../../entities/User';
import { Job } from '../../entities/Job';
import { Resume } from '../../entities/Resume';
import { Application } from '../../entities/Application';
import { JobChunk } from '../../entities/JobChunk';
import { ResumeChunk } from '../../entities/ResumeChunk';
import { CreateApplicationDto } from '../../interfaces/dto/CreateApplicationDto';
import { MatchResult } from '../../interfaces/domain/MatchResult';
import { AuthUser } from '../../middleware/authContext.middleware';
import { parseFile } from '../../utils/textParser';
import { chunkText } from '../../utils/chunker';
import { analyzeSkillsMatch, SkillMatchSummary } from '../../utils/skillExtractor';
import { embedMany } from '../../utils/embedding';
import { AppError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

export class ApplicationService {
  private userRepository = AppDataSource.getRepository(User);
  private jobRepository = AppDataSource.getRepository(Job);
  private resumeRepository = AppDataSource.getRepository(Resume);
  private applicationRepository = AppDataSource.getRepository(Application);
  private jobChunkRepository = AppDataSource.getRepository(JobChunk);
  private resumeChunkRepository = AppDataSource.getRepository(ResumeChunk);

  async createApplication(dto: CreateApplicationDto, recruiterUser: AuthUser): Promise<{
    applicationId: string;
    jobId: string;
    match: MatchResult;
  }> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate recruiter role
      if (recruiterUser.role !== 'recruiter') {
        throw new AppError('Only recruiters can create applications', 403);
      }

      // Validate required fields
      if (!dto.jobKey || !dto.candidateUserId || !dto.jdFile || !dto.resumeFile) {
        throw new AppError('Missing required fields', 400);
      }

      // Upsert candidate user
      let candidateUser = await this.userRepository.findOne({ where: { externalId: dto.candidateUserId } });
      if (!candidateUser) {
        candidateUser = this.userRepository.create({
          externalId: dto.candidateUserId,
          role: 'candidate'
        });
        await queryRunner.manager.save(candidateUser);
      }

      // Parse files
      const jdText = await parseFile(dto.jdFile);
      const resumeText = await parseFile(dto.resumeFile);

      if (jdText.length < 100 || resumeText.length < 100) {
        throw new AppError('Extracted text too short for analysis', 422);
      }

      // Upsert Job
      const recruiterUserEntity = await this.userRepository.findOne({ where: { id: recruiterUser.id } });
      if (!recruiterUserEntity) {
        throw new AppError('Recruiter not found', 404);
      }

      let job = await this.jobRepository.findOne({
        where: { recruiter: { id: recruiterUser.id }, jobKey: dto.jobKey }
      });

      if (!job) {
        // Create new job with chunks and embeddings
        const newJob = this.jobRepository.create({
          recruiter: recruiterUserEntity,
          jobKey: dto.jobKey,
          title: dto.jobTitle || null,
          jdText
        });
        await queryRunner.manager.save(newJob);
        job = newJob;

        // Chunk and embed JD
        const jdChunks = chunkText(jdText);
        const jdEmbeddings = await embedMany(jdChunks);

        const jobChunks = jdChunks.map((content, idx) => {
          const chunk = this.jobChunkRepository.create({
            job: newJob,
            idx,
            content,
            embedding: jdEmbeddings[idx]
          });
          return chunk;
        });

        await queryRunner.manager.save(jobChunks);
        logger.info('Created job with chunks', { jobId: newJob.id, chunkCount: jobChunks.length });
      }

      if (!job) {
        throw new AppError('Failed to upsert job for application', 500);
      }

      // Create Resume
      const resume = this.resumeRepository.create({
        candidate: candidateUser,
        rawText: resumeText,
        metadata: { filename: dto.resumeFile.originalname }
      });
      await queryRunner.manager.save(resume);

      // Chunk and embed resume
      const resumeChunks = chunkText(resumeText);
      const resumeEmbeddings = await embedMany(resumeChunks);

      const resumeChunkEntities = resumeChunks.map((content, idx) => {
        const chunk = this.resumeChunkRepository.create({
          resume,
          idx,
          content,
          embedding: resumeEmbeddings[idx]
        });
        return chunk;
      });

      await queryRunner.manager.save(resumeChunkEntities);

      // Compute match score
      const matchResult = await this.computeMatchScore(jdText, resumeText);

      // Create Application
      const application = this.applicationRepository.create({
        job,
        resume,
        matchScore: matchResult.score,
        strengths: matchResult.strengths,
        gaps: matchResult.gaps,
        extraSkills: matchResult.extraSkills,
        insights: matchResult.insights,
        experienceHighlight: matchResult.experienceHighlight
      });
      await queryRunner.manager.save(application);

      await queryRunner.commitTransaction();

      logger.info('Created application', { 
        applicationId: application.id, 
        jobId: job.id, 
        matchScore: matchResult.score 
      });

      return {
        applicationId: application.id,
        jobId: job.id,
        match: matchResult
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to create application', error);
      throw new AppError('Failed to create application', 500);
    } finally {
      await queryRunner.release();
    }
  }

  async getApplication(applicationId: string, user: AuthUser): Promise<{
    applicationId: string;
    jobKey: string;
    jobTitle: string | null;
    match: MatchResult;
    createdAt: Date;
  }> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
      relations: ['job', 'job.recruiter', 'resume', 'resume.candidate']
    });

    if (!application) {
      throw new AppError('Application not found', 404);
    }

    // Check access rights
    const hasAccess = 
      (user.role === 'recruiter' && application.job.recruiter.id === user.id) ||
      (user.role === 'candidate' && application.resume.candidate.id === user.id);

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    return {
      applicationId: application.id,
      jobKey: application.job.jobKey,
      jobTitle: application.job.title,
      match: {
        score: application.matchScore || 0,
        strengths: application.strengths || [],
        gaps: application.gaps || [],
        extraSkills: application.extraSkills || [],
        insights: application.insights || [],
        experienceHighlight: application.experienceHighlight || null
      },
      createdAt: application.createdAt
    };
  }

  async getJobApplications(jobKey: string, recruiterUser: AuthUser): Promise<{
    jobKey: string;
    applications: Array<{
      applicationId: string;
      candidateUserId: string;
      matchScore: number;
      createdAt: Date;
    }>;
  }> {
    if (recruiterUser.role !== 'recruiter') {
      throw new AppError('Only recruiters can view job applications', 403);
    }

    const job = await this.jobRepository.findOne({
      where: { recruiter: { id: recruiterUser.id }, jobKey },
      relations: ['recruiter']
    });

    if (!job) {
      throw new AppError('Job not found', 404);
    }

    const results = await AppDataSource.query(`
      SELECT
        a.id AS application_id,
        a.match_score,
        a.created_at,
        cu.external_id AS candidate_user_id
      FROM applications a
      JOIN resumes r ON r.id = a.resume_id
      JOIN users cu ON cu.id = r.candidate_user_id
      WHERE a.job_id = $1
      ORDER BY a.created_at DESC
    `, [job.id]);

    return {
      jobKey,
      applications: results.map((row: any) => ({
        applicationId: row.application_id,
        candidateUserId: row.candidate_user_id,
        matchScore: parseFloat(row.match_score) || 0,
        createdAt: row.created_at
      }))
    };
  }

  private async computeMatchScore(jdText: string, resumeText: string): Promise<MatchResult> {
    const summary = await analyzeSkillsMatch(jdText, resumeText);
    const insights = this.buildInsights(summary);
    const experienceHighlight = this.buildExperienceHighlight(summary, resumeText);

    return {
      score: summary.matchScore,
      strengths: summary.strengths,
      gaps: summary.gaps,
      extraSkills: summary.extraSkills,
      insights,
      experienceHighlight
    };
  }

  private buildInsights(summary: SkillMatchSummary): string[] {
    if (summary.jdSkills.length === 0) {
      return ['No skills detected in job description'];
    }

    const insights: string[] = [
      `Matched ${summary.strengths.length}/${summary.jdSkills.length} JD skills (${summary.matchScore}%)`
    ];

    if (summary.gaps.length > 0) {
      insights.push(`Gaps: ${summary.gaps.join(', ')}`);
    }

    if (summary.extraSkills.length > 0) {
      const preview = summary.extraSkills.slice(0, 8).join(', ');
      insights.push(`Extra resume skills: ${preview}`);
    }

    return insights;
  }

  private buildExperienceHighlight(summary: SkillMatchSummary, resumeText: string): string | null {
    const normalizedResume = resumeText || '';
    const yearsMatch = normalizedResume.match(/(\d+\+?)(?=\s*(?:years?|yrs))/i);
    const yearsValue = yearsMatch ? yearsMatch[1] : null;
    const strengthsPreview = summary.strengths.slice(0, 3).join(', ');

    if (!yearsValue && !strengthsPreview) {
      return null;
    }

    if (yearsValue && strengthsPreview) {
      return `${yearsValue} years of experience across ${strengthsPreview}.`;
    }

    if (yearsValue) {
      return `${yearsValue} years of relevant experience.`;
    }

    return `Experience with ${strengthsPreview}.`;
  }
}
