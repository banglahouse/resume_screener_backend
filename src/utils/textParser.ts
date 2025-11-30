import pdfParse from 'pdf-parse';
import { logger } from './logger';

export async function parseFile(file: Express.Multer.File): Promise<string> {
  try {
    let text = '';

    if (file.mimetype === 'application/pdf') {
      const pdfData = await pdfParse(file.buffer);
      text = pdfData.text;
    } else if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      text = file.buffer.toString('utf-8');
    } else {
      throw new Error(`Unsupported file type: ${file.mimetype}`);
    }

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    if (text.length < 100) {
      throw new Error('Extracted text too short (less than 100 characters)');
    }

    // Limit to 50k characters for analysis
    if (text.length > 50000) {
      text = text.substring(0, 50000);
      logger.warn('Document truncated for analysis', { originalLength: text.length });
    }

    return text;
  } catch (error) {
    logger.error('Failed to parse file', error);
    throw new Error('Could not extract text from file');
  }
}