import { ApplicationService } from '../shared/application.service';
import { ChatService } from '../shared/chat.service';

// Candidate-specific service logic can be added here if needed
// For now, it delegates to shared services
export class CandidateService {
  private applicationService = new ApplicationService();
  private chatService = new ChatService();

  // Additional candidate-specific methods can be added here
  // For example: profile management, application tracking, etc.
}