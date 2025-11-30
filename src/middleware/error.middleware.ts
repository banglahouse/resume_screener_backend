import { Request, Response, NextFunction } from 'express';
import { handleError, notFoundHandler } from '../utils/errorHandler';

export { handleError as errorMiddleware, notFoundHandler };