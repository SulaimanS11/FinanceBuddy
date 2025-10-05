import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
  path: string;
  method: string;
}

/**
 * Custom error class for API errors
 */
export class ApiErrorClass extends Error implements ApiError {
  public statusCode: number;
  public code?: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Create standardized API errors
 */
export const createApiError = {
  badRequest: (message: string, details?: any) => 
    new ApiErrorClass(message, 400, 'BAD_REQUEST', details),
  
  unauthorized: (message: string = 'Unauthorized') => 
    new ApiErrorClass(message, 401, 'UNAUTHORIZED'),
  
  forbidden: (message: string = 'Forbidden') => 
    new ApiErrorClass(message, 403, 'FORBIDDEN'),
  
  notFound: (message: string = 'Resource not found') => 
    new ApiErrorClass(message, 404, 'NOT_FOUND'),
  
  conflict: (message: string, details?: any) => 
    new ApiErrorClass(message, 409, 'CONFLICT', details),
  
  unprocessableEntity: (message: string, details?: any) => 
    new ApiErrorClass(message, 422, 'UNPROCESSABLE_ENTITY', details),
  
  tooManyRequests: (message: string = 'Too many requests') => 
    new ApiErrorClass(message, 429, 'TOO_MANY_REQUESTS'),
  
  internalServer: (message: string = 'Internal server error', details?: any) => 
    new ApiErrorClass(message, 500, 'INTERNAL_SERVER_ERROR', details),
  
  serviceUnavailable: (message: string = 'Service unavailable') => 
    new ApiErrorClass(message, 503, 'SERVICE_UNAVAILABLE'),
  
  gatewayTimeout: (message: string = 'Gateway timeout') => 
    new ApiErrorClass(message, 504, 'GATEWAY_TIMEOUT')
};

/**
 * Map common error types to appropriate HTTP status codes
 */
function mapErrorToStatusCode(error: Error): number {
  const errorMessage = error.message.toLowerCase();
  
  if (errorMessage.includes('session not found') || 
      errorMessage.includes('not found')) {
    return 404;
  }
  
  if (errorMessage.includes('expired') || 
      errorMessage.includes('invalid session')) {
    return 410; // Gone
  }
  
  if (errorMessage.includes('validation') || 
      errorMessage.includes('invalid') ||
      errorMessage.includes('required')) {
    return 400;
  }
  
  if (errorMessage.includes('unauthorized') || 
      errorMessage.includes('authentication')) {
    return 401;
  }
  
  if (errorMessage.includes('forbidden') || 
      errorMessage.includes('permission')) {
    return 403;
  }
  
  if (errorMessage.includes('conflict') || 
      errorMessage.includes('already exists')) {
    return 409;
  }
  
  if (errorMessage.includes('rate limit') || 
      errorMessage.includes('too many')) {
    return 429;
  }
  
  if (errorMessage.includes('timeout') || 
      errorMessage.includes('timed out')) {
    return 504;
  }
  
  if (errorMessage.includes('service unavailable') || 
      errorMessage.includes('temporarily unavailable')) {
    return 503;
  }
  
  return 500; // Default to internal server error
}

/**
 * Global error handling middleware
 */
export function errorHandler(
  error: ApiError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  // Determine status code
  const statusCode = (error as ApiError).statusCode || mapErrorToStatusCode(error);
  
  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: error.name || 'Error',
    message: error.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // Add error code if available
  if ((error as ApiError).code) {
    errorResponse.code = (error as ApiError).code;
  }

  // Add details for development/debugging (be careful not to expose sensitive info)
  if ((error as ApiError).details && process.env['NODE_ENV'] !== 'production') {
    errorResponse.details = (error as ApiError).details;
  }

  // Log error for monitoring
  console.error(`API Error [${statusCode}] ${req.method} ${req.path}:`, {
    error: error.message,
    stack: error.stack,
    body: req.body,
    params: req.params,
    query: req.query,
    timestamp: errorResponse.timestamp
  });

  // Send error response
  res.status(statusCode).json(errorResponse);
}

/**
 * Middleware to handle async route errors
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Middleware to handle 404 errors for undefined routes
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = createApiError.notFound(`Route ${req.method} ${req.path} not found`);
  next(error);
}

/**
 * Middleware to handle specific service errors
 */
export function handleServiceError(error: Error, serviceName: string): ApiError {
  const message = error.message;
  
  // Handle AI service errors
  if (serviceName === 'gemini' || serviceName === 'ai') {
    if (message.includes('rate limit') || message.includes('quota')) {
      return createApiError.tooManyRequests('AI service rate limit exceeded. Please try again later.');
    }
    if (message.includes('timeout')) {
      return createApiError.gatewayTimeout('AI service timeout. Please try again.');
    }
    if (message.includes('unavailable') || message.includes('connection')) {
      return createApiError.serviceUnavailable('AI service is temporarily unavailable.');
    }
    return createApiError.internalServer('AI service error occurred.');
  }
  
  // Handle vector store errors
  if (serviceName === 'vector' || serviceName === 'embedding') {
    if (message.includes('connection') || message.includes('unavailable')) {
      return createApiError.serviceUnavailable('Vector database is temporarily unavailable.');
    }
    return createApiError.internalServer('Vector database error occurred.');
  }
  
  // Handle session management errors
  if (serviceName === 'session') {
    if (message.includes('not found')) {
      return createApiError.notFound('Session not found or expired.');
    }
    if (message.includes('expired')) {
      return createApiError.notFound('Session has expired.');
    }
    if (message.includes('invalid transition') || message.includes('not allowed')) {
      return createApiError.conflict('Invalid session state transition.', { currentAction: message });
    }
    return createApiError.internalServer('Session management error occurred.');
  }
  
  // Default handling
  return createApiError.internalServer(`${serviceName} service error: ${message}`);
}

/**
 * Middleware to validate that required services are available
 */
export function validateServicesMiddleware(req: Request, res: Response, next: NextFunction): void {
  // This could be extended to check service health
  // For now, just continue
  next();
}