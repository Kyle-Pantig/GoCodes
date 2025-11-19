/**
 * Database utility functions for handling retries and connection errors
 */

import { PrismaClientInitializationError, PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

/**
 * Retry operation with exponential backoff for transient database connection errors
 * @param operation - The async operation to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param delay - Initial delay in milliseconds (default: 1000)
 * @returns The result of the operation
 */
export async function retryDbOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: unknown
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: unknown) {
      lastError = error
      
      // Extract error message and check error type
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorName = error instanceof Error ? error.name : ''
      
      // Check if it's a connection-related error
      const isConnectionError = 
        // Prisma error types
        error instanceof PrismaClientInitializationError ||
        (error instanceof PrismaClientKnownRequestError && 
         (error.code === 'P1001' || error.code === 'P2024' || error.code === 'P1017')) ||
        // Error message patterns
        errorMessage.includes("Can't reach database server") ||
        errorMessage.includes("Can't reach database") ||
        errorMessage.includes("Connection timeout") ||
        errorMessage.includes("connection pool") ||
        errorMessage.includes("Timed out fetching") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("ENOTFOUND") ||
        errorMessage.includes("Connection closed") ||
        errorMessage.includes("Connection terminated") ||
        (errorMessage.includes("timeout") && errorMessage.includes("connection")) ||
        // Error name patterns
        errorName.includes("PrismaClientInitializationError") ||
        errorName.includes("ConnectionError")
      
      // Only retry if it's a connection error and we have retries left
      if (isConnectionError && attempt < maxRetries - 1) {
        const attemptNum = attempt + 1
        const errorCode = error instanceof PrismaClientKnownRequestError ? error.code : 
                         error instanceof PrismaClientInitializationError ? 'INIT_ERROR' : 'CONN_ERROR'
        
        // Extract error details for better debugging
        const errorDetails = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        
        // Log with error details to help diagnose connection issues
        // Log first 200 chars of message, and full stack if available
        console.warn(`[DB] Connection error (attempt ${attemptNum}/${maxRetries}, code: ${errorCode})`)
        console.warn(`[DB] Error message: ${errorDetails.substring(0, 200)}${errorDetails.length > 200 ? '...' : ''}`)
        if (errorStack && attemptNum === maxRetries) {
          // Only log full stack on final attempt to avoid noise
          console.warn(`[DB] Error stack: ${errorStack.substring(0, 500)}`)
        }
        
        // Exponential backoff with jitter: 500ms, 1000ms, 2000ms (reduced for faster recovery)
        // Add small random jitter to prevent thundering herd
        const baseDelay = delay * Math.pow(2, attempt) * 0.5 // Reduced base delay
        const jitter = Math.random() * 200 // 0-200ms random jitter
        const backoffDelay = baseDelay + jitter
        
        await new Promise(resolve => setTimeout(resolve, backoffDelay))
        continue
      }
      
      // If not retryable or out of retries, throw the error
      throw error
    }
  }
  
  // If we exhausted all retries, throw the last error
  throw lastError
}

