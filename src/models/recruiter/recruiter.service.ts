import { ApplicationService } from '../shared/application.service';
import { ChatService } from '../shared/chat.service';

// Recruiter-specific service logic can be added here if needed
// For now, it delegates to shared services
export class RecruiterService {
  private applicationService = new ApplicationService();
  private chatService = new ChatService();

  // Additional recruiter-specific methods can be added here
  // For example: analytics, bulk operations, etc.
}