import { Router } from 'express';
import { CandidateController } from './candidate.controller';

const router = Router();
const controller = new CandidateController();

// GET /api/applications/:applicationId - Get application details
router.get('/applications/:applicationId', controller.getApplication.bind(controller));

// POST /api/applications/:applicationId/chat - Chat about application
router.post('/applications/:applicationId/chat', controller.chatApplication.bind(controller));

// GET /api/applications/:applicationId/chats - Get chat history
router.get('/applications/:applicationId/chats', controller.getChatHistory.bind(controller));

export { router as candidateRoutes };