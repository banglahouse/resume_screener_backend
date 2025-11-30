import { Request, Response, NextFunction } from 'express';
import { ApplicationService } from '../shared/application.service';
import { ChatService } from '../shared/chat.service';
import { CreateApplicationDto } from '../../interfaces/dto/CreateApplicationDto';
import { ChatRequestDto } from '../../interfaces/dto/ChatRequestDto';
import { AppError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

export class RecruiterController {
  private applicationService = new ApplicationService();
  private chatService = new ChatService();

  async createApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const { jobKey, jobTitle, candidateUserId } = req.body;

      const fileMap = !req.files || Array.isArray(req.files)
        ? undefined
        : (req.files as Record<string, Express.Multer.File[]>);

      const jdFile = fileMap?.jdFile?.[0];
      const resumeFile = fileMap?.resumeFile?.[0];

      if (!jdFile || !resumeFile) {
        throw new AppError('Both jdFile and resumeFile are required', 400);
      }

      if (!jdFile.mimetype.includes('pdf') && !jdFile.mimetype.includes('text/plain')) {
        throw new AppError('JD file must be PDF or TXT', 400);
      }

      if (!resumeFile.mimetype.includes('pdf') && !resumeFile.mimetype.includes('text/plain')) {
        throw new AppError('Resume file must be PDF or TXT', 400);
      }

      const dto: CreateApplicationDto = {
        jobKey,
        jobTitle,
        candidateUserId,
        jdFile,
        resumeFile
      };

      const result = await this.applicationService.createApplication(dto, req.user);
      
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const { applicationId } = req.params;
      
      const result = await this.applicationService.getApplication(applicationId, req.user);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getJobApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const { jobKey } = req.params;
      
      const result = await this.applicationService.getJobApplications(jobKey, req.user);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async chatApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const { applicationId } = req.params;
      const dto: ChatRequestDto = req.body;
      
      const result = await this.chatService.chat(applicationId, dto, req.user);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getChatHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { applicationId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const result = await this.chatService.getChatHistory(applicationId, req.user, limit, offset);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
