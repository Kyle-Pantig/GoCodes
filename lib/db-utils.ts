/**
 * Database utility functions for handling retries and connection errors
 */

import { PrismaClientInitializationError, PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

/**
 * Retry operation with exponential backoff for transient database connection errors
 * @param operation - The async operation to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param delay - Initial delay in milliseconds (default: 500)
 * @returns The result of the operation
 */
export async function retryDbOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 500
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: unknown) {
      lastError = error
      
      // Check if it's a Prisma initialization error (connection failure)
      if (error instanceof PrismaClientInitializationError) {
        const isRetryable = attempt < maxRetries - 1
        if (isRetryable) {
          console.warn(`[DB] Connection error (attempt ${attempt + 1}/${maxRetries}):`, error.message)
          // Exponential backoff: 500ms, 1000ms, 2000ms
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)))
          continue
        }
      }
      
      // Check for Prisma error codes
      if (error instanceof PrismaClientKnownRequestError) {
        const isRetryableError = (error.code === 'P1001' || error.code === 'P2024') && attempt < maxRetries - 1
        if (isRetryableError) {
          console.warn(`[DB] Retryable error ${error.code} (attempt ${attempt + 1}/${maxRetries})`)
          // Exponential backoff: 500ms, 1000ms, 2000ms
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)))
          continue
        }
      }
      
      // Check for generic connection errors by message (more specific patterns)
      const errorMessage = error instanceof Error ? error.message : String(error)
      const isConnectionError = 
        errorMessage.includes("Can't reach database server") ||
        errorMessage.includes("Can't reach database") ||
        errorMessage.includes("Connection timeout") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("ENOTFOUND") ||
        (errorMessage.includes("timeout") && errorMessage.includes("connection"))
      
      if (isConnectionError && attempt < maxRetries - 1) {
        console.warn(`[DB] Connection error detected (attempt ${attempt + 1}/${maxRetries}):`, errorMessage)
        // Exponential backoff: 500ms, 1000ms, 2000ms
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)))
        continue
      }
      
      throw error
    }
  }
  throw lastError
}

