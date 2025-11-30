import OpenAI from 'openai';
import { AppDataSource } from '../../config/data-source';
import { Application } from '../../entities/Application';
import { ChatMessage } from '../../entities/ChatMessage';
import { ChatRequestDto } from '../../interfaces/dto/ChatRequestDto';
import { ChatMessageModel, ChatSource } from '../../interfaces/domain/ChatMessageModel';
import { AuthUser } from '../../middleware/authContext.middleware';
import { embedText } from '../../utils/embedding';
import { AppError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY
});

export class ChatService {
  private applicationRepository = AppDataSource.getRepository(Application);
  private chatMessageRepository = AppDataSource.getRepository(ChatMessage);

  async chat(
    applicationId: string,
    dto: ChatRequestDto,
    user: AuthUser
  ): Promise<{
    answer: string;
    sources: ChatSource[];
  }> {
    // Validate question
    const question = dto.question?.trim();
    if (!question || question.length === 0) {
      throw new AppError('Question cannot be empty', 400);
    }

    // Load application with relations
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

    try {
      // Generate embedding for question
      const questionEmbedding = await embedText(question);
      const embeddingArray = `[${questionEmbedding.join(',')}]`;

      // Search job chunks
      const jobChunks = await AppDataSource.query(`
        SELECT id, content, embedding <-> $1 AS distance
        FROM job_chunks
        WHERE job_id = $2
        ORDER BY embedding <-> $1
        LIMIT 5
      `, [embeddingArray, application.job.id]);

      // Search resume chunks
      const resumeChunks = await AppDataSource.query(`
        SELECT id, content, embedding <-> $1 AS distance
        FROM resume_chunks
        WHERE resume_id = $2
        ORDER BY embedding <-> $1
        LIMIT 5
      `, [embeddingArray, application.resume.id]);

      // Merge and sort by distance, take top 6-8
      const allChunks = [
        ...jobChunks.map((chunk: any) => ({ ...chunk, type: 'jd' })),
        ...resumeChunks.map((chunk: any) => ({ ...chunk, type: 'resume' }))
      ].sort((a, b) => a.distance - b.distance).slice(0, 8);

      // Load recent chat history
      const recentMessages = await this.chatMessageRepository.find({
        where: { application: { id: applicationId } },
        order: { createdAt: 'DESC' },
        take: 10
      });

      // Build context
      const contextSections = allChunks.map(chunk => 
        `[${chunk.type.toUpperCase()}]: ${chunk.content}`
      ).join('\n\n');

      // Build chat messages for OpenAI
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `You are a resume screening assistant helping recruiters and candidates understand how well a resume matches a job description. 

IMPORTANT INSTRUCTIONS:
1. Only use information from the provided context below
2. If you cannot answer based on the context, say "I don't have enough information in the provided context to answer that question"
3. Be specific and reference the context when possible
4. Focus on skills, experience, and job requirements matching

CONTEXT:
${contextSections}`
        }
      ];

      // Add recent conversation history (reverse to get chronological order)
      const historyMessages = recentMessages.reverse().slice(-8); // Keep last 8 messages
      for (const msg of historyMessages) {
        messages.push({
          role: msg.role as any,
          content: msg.content
        });
      }

      // Add current question
      messages.push({
        role: 'user',
        content: question
      });

      // Call OpenAI
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 500,
        temperature: 0.7
      });

      const answer = completion.choices[0]?.message?.content || 'I apologize, but I cannot provide an answer at this time.';

      // Save chat messages
      const userMessage = this.chatMessageRepository.create({
        application,
        role: 'user',
        content: question
      });

      const assistantMessage = this.chatMessageRepository.create({
        application,
        role: 'assistant',
        content: answer
      });

      await this.chatMessageRepository.save([userMessage, assistantMessage]);

      // Prepare sources
      const sources: ChatSource[] = allChunks.map(chunk => ({
        type: chunk.type as 'resume' | 'jd',
        chunkId: chunk.id,
        excerpt: chunk.content.length > 200 
          ? chunk.content.substring(0, 200) + '...'
          : chunk.content
      }));

      logger.info('Completed chat interaction', { 
        applicationId, 
        userId: user.id, 
        sourcesCount: sources.length 
      });

      return { answer, sources };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Chat service error', error);
      throw new AppError('Chat service unavailable, try again later', 502);
    }
  }

  async getChatHistory(
    applicationId: string,
    user: AuthUser,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    applicationId: string;
    messages: ChatMessageModel[];
  }> {
    // Load application for access check
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

    // Fetch chat history
    const messages = await this.chatMessageRepository.find({
      where: { application: { id: applicationId } },
      order: { createdAt: 'ASC' },
      take: limit,
      skip: offset
    });

    return {
      applicationId,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt
      }))
    };
  }
}