import { ApiError, ErrorType } from '../types/SearchTypes';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: ErrorType[];
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  attempts: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    ErrorType.NETWORK_ERROR,
    ErrorType.API_ERROR,
    ErrorType.WEBSOCKET_ERROR
  ]
};

/**
 * Utility class for implementing retry mechanisms with exponential backoff
 */
export class RetryUtils {
  /**
   * Execute a function with retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<RetryResult<T>> {
    const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: ApiError | null = null;
    
    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        const result = await operation();
        return {
          success: true,
          data: result,
          attempts: attempt
        };
      } catch (error) {
        lastError = this.normalizeError(error);
        
        // Don't retry if this is the last attempt
        if (attempt === finalConfig.maxAttempts) {
          break;
        }
        
        // Don't retry if error is not retryable
        if (!this.isRetryableError(lastError, finalConfig.retryableErrors)) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt - 1),
          finalConfig.maxDelay
        );
        
        console.log(`Retry attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
        await this.delay(delay);
      }
    }
    
    return {
      success: false,
      error: lastError || {
        type: ErrorType.API_ERROR,
        message: 'Unknown error occurred',
        timestamp: Date.now()
      },
      attempts: finalConfig.maxAttempts
    };
  }

  /**
   * Create a retryable version of a service method
   */
  static createRetryableMethod<T extends any[], R>(
    method: (...args: T) => Promise<R>,
    config: Partial<RetryConfig> = {}
  ): (...args: T) => Promise<RetryResult<R>> {
    return async (...args: T) => {
      return this.withRetry(() => method(...args), config);
    };
  }

  /**
   * Check if an error is retryable based on configuration
   */
  private static isRetryableError(error: ApiError, retryableErrors: ErrorType[]): boolean {
    // Always retry network errors
    if (error.type === ErrorType.NETWORK_ERROR) {
      return true;
    }
    
    // Check if error type is in retryable list
    if (!retryableErrors.includes(error.type)) {
      return false;
    }
    
    // Don't retry certain HTTP status codes
    if (error.type === ErrorType.API_ERROR && error.code) {
      const code = typeof error.code === 'number' ? error.code : parseInt(error.code.toString());
      
      // Don't retry client errors (4xx) except for specific cases
      if (code >= 400 && code < 500) {
        // Retry these specific client errors
        const retryableClientErrors = [408, 429]; // Request Timeout, Too Many Requests
        return retryableClientErrors.includes(code);
      }
      
      // Retry server errors (5xx)
      if (code >= 500) {
        return true;
      }
    }
    
    return true;
  }

  /**
   * Normalize different error types to ApiError
   */
  private static normalizeError(error: any): ApiError {
    if (error && typeof error === 'object' && 'type' in error) {
      return error as ApiError;
    }
    
    if (error instanceof Error) {
      return {
        type: ErrorType.API_ERROR,
        message: error.message,
        timestamp: Date.now()
      };
    }
    
    return {
      type: ErrorType.API_ERROR,
      message: typeof error === 'string' ? error : 'Unknown error',
      timestamp: Date.now()
    };
  }

  /**
   * Simple delay utility
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Decorator for adding retry logic to class methods
 */
export function withRetry(config: Partial<RetryConfig> = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const result = await RetryUtils.withRetry(
        () => originalMethod.apply(this, args),
        config
      );
      
      if (result.success) {
        return result.data;
      } else {
        throw result.error;
      }
    };
    
    return descriptor;
  };
}

/**
 * Hook for using retry logic in React components
 */
export function useRetry<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  config: Partial<RetryConfig> = {}
) {
  const retryableOperation = RetryUtils.createRetryableMethod(operation, config);
  
  return {
    execute: retryableOperation,
    executeWithoutRetry: operation
  };
}