import { Request, Response, NextFunction } from 'express';
import { ApplicationService } from '../shared/application.service';
import { ChatService } from '../shared/chat.service';
import { ChatRequestDto } from '../../interfaces/dto/ChatRequestDto';

export class CandidateController {
  private applicationService = new ApplicationService();
  private chatService = new ChatService();

  async getApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const { applicationId } = req.params;
      
      const result = await this.applicationService.getApplication(applicationId, req.user);
      
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