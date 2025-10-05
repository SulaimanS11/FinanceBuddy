import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Validation schemas
export const sessionCreationSchema = Joi.object({
  topic: Joi.string()
    .min(3)
    .max(200)
    .required()
    .messages({
      'string.min': 'Topic must be at least 3 characters long',
      'string.max': 'Topic cannot exceed 200 characters',
      'any.required': 'Topic is required'
    }),
  questionCount: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .required()
    .messages({
      'number.base': 'Question count must be a number',
      'number.integer': 'Question count must be an integer',
      'number.min': 'Question count must be at least 1',
      'number.max': 'Question count cannot exceed 20',
      'any.required': 'Question count is required'
    }),
  userId: Joi.string()
    .optional()
    .allow('')
    .max(100)
    .messages({
      'string.max': 'User ID cannot exceed 100 characters'
    })
});

export const userAnswersSchema = Joi.object({
  userAnswers: Joi.object()
    .pattern(
      Joi.string(),
      Joi.string().valid('A', 'B', 'C', 'D')
    )
    .optional()
    .messages({
      'object.pattern.match': 'User answers must be A, B, C, or D'
    })
});

export const followupQuestionSchema = Joi.object({
  question: Joi.string()
    .min(5)
    .max(500)
    .required()
    .messages({
      'string.min': 'Follow-up question must be at least 5 characters long',
      'string.max': 'Follow-up question cannot exceed 500 characters',
      'any.required': 'Follow-up question is required'
    })
});

export const sessionIdSchema = Joi.object({
  id: Joi.string()
    .required()
    .pattern(/^session_\d+_[a-z0-9]+$/)
    .messages({
      'string.pattern.base': 'Invalid session ID format',
      'any.required': 'Session ID is required'
    })
});

/**
 * Middleware to validate request body against a Joi schema
 */
export function validateBody(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors,
        timestamp: new Date().toISOString()
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
}

/**
 * Middleware to validate request parameters against a Joi schema
 */
export function validateParams(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Invalid parameters',
        details: validationErrors,
        timestamp: new Date().toISOString()
      });
    }

    // Replace req.params with validated data
    req.params = value;
    next();
  };
}

/**
 * Middleware to validate query parameters
 */
export function validateQuery(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Invalid query parameters',
        details: validationErrors,
        timestamp: new Date().toISOString()
      });
    }

    req.query = value;
    next();
  };
}

/**
 * Custom validation function for topic relevance
 */
export function validateTopicRelevance(topic: string): ValidationResult {
  const errors: ValidationError[] = [];
  
  // Check for securities-related keywords
  const securitiesKeywords = [
    'stock', 'bond', 'option', 'derivative', 'portfolio', 'investment',
    'equity', 'debt', 'market', 'trading', 'finance', 'security',
    'mutual fund', 'etf', 'dividend', 'yield', 'risk', 'return',
    'valuation', 'analysis', 'regulation', 'compliance'
  ];

  const topicLower = topic.toLowerCase();
  const hasRelevantKeywords = securitiesKeywords.some(keyword => 
    topicLower.includes(keyword)
  );

  if (!hasRelevantKeywords) {
    errors.push({
      field: 'topic',
      message: 'Topic should be related to securities, finance, or investments'
    });
  }

  // Check for inappropriate content
  const inappropriatePatterns = [
    /\b(hack|crack|illegal|fraud|scam)\b/i,
    /\b(personal|private|confidential)\b/i
  ];

  const hasInappropriateContent = inappropriatePatterns.some(pattern => 
    pattern.test(topic)
  );

  if (hasInappropriateContent) {
    errors.push({
      field: 'topic',
      message: 'Topic contains inappropriate content'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Middleware to validate topic relevance
 */
export function validateTopicMiddleware(req: Request, res: Response, next: NextFunction) {
  const { topic } = req.body;
  
  if (!topic) {
    return next(); // Let Joi validation handle missing topic
  }

  const validation = validateTopicRelevance(topic);
  
  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Topic validation failed',
      details: validation.errors,
      timestamp: new Date().toISOString()
    });
  }

  next();
}