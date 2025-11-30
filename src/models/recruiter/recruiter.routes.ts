import { Router } from 'express';
import multer from 'multer';
import { RecruiterController } from './recruiter.controller';

const router = Router();
const controller = new RecruiterController();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// POST /api/applications - Create new application
router.post('/applications', 
  upload.fields([
    { name: 'jdFile', maxCount: 1 },
    { name: 'resumeFile', maxCount: 1 }
  ]), 
  controller.createApplication.bind(controller)
);

// GET /api/applications/:applicationId - Get application details
router.get('/applications/:applicationId', controller.getApplication.bind(controller));

// GET /api/jobs/:jobKey/applications - List applications for a job
router.get('/jobs/:jobKey/applications', controller.getJobApplications.bind(controller));

// POST /api/applications/:applicationId/chat - Chat about application
router.post('/applications/:applicationId/chat', controller.chatApplication.bind(controller));

// GET /api/applications/:applicationId/chats - Get chat history
router.get('/applications/:applicationId/chats', controller.getChatHistory.bind(controller));

export { router as recruiterRoutes };