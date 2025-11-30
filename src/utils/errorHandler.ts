import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    logger.error('Application error', { message: err.message, statusCode: err.statusCode });
    return res.status(err.statusCode).json({
      error: err.message
    });
  }

  // Handle specific error types
  if (err.message.includes('duplicate key value')) {
    return res.status(409).json({
      error: 'Resource already exists'
    });
  }

  if (err.message.includes('foreign key constraint')) {
    return res.status(400).json({
      error: 'Invalid reference to related resource'
    });
  }

  if (err.message.includes('Embedding service unavailable')) {
    return res.status(502).json({
      error: 'LLM service unavailable, try again later'
    });
  }

  // Log unexpected errors
  logger.error('Unexpected error', err);
  
  res.status(500).json({
    error: 'Internal server error'
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found'
  });
};