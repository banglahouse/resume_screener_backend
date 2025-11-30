export interface CreateApplicationDto {
  jobKey: string;
  jobTitle?: string;
  candidateUserId: string;
  jdFile: Express.Multer.File;
  resumeFile: Express.Multer.File;
}