import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global HTTP Exception Filter
 *
 * Formats all errors into a consistent structure:
 * {
 *   error: {
 *     message: string,
 *     code: string,
 *     statusCode: number
 *   }
 * }
 *
 * For OAuth2.0 endpoints, returns RFC 6749 compliant error format instead.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly OAUTH_PATHS = ['/api/oauth'];

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const path = request.url?.split('?')[0];

    // Determine status code and error details
    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException
      ? exception.getResponse()
      : null;

    // OAuth2.0 endpoints should return spec-compliant error format
    if (this.shouldUseOAuthFormat(path)) {
      return this.handleOAuthError(response, statusCode, exceptionResponse);
    }

    // Standard error format for non-OAuth endpoints
    const errorMessage = this.extractErrorMessage(
      exceptionResponse,
      exception
    );
    const errorCode = this.generateErrorCode(statusCode, exceptionResponse);

    response.status(statusCode).json({
      error: {
        message: errorMessage,
        code: errorCode,
        statusCode,
      },
    });
  }

  private shouldUseOAuthFormat(path: string): boolean {
    if (!path) return false;
    return this.OAUTH_PATHS.some((oauthPath) => path.startsWith(oauthPath));
  }

  /**
   * Handle OAuth2.0 RFC 6749 compliant error responses
   */
  private handleOAuthError(
    response: Response,
    statusCode: number,
    exceptionResponse: any
  ) {
    // Extract OAuth error if present
    let oauthError = 'server_error';
    let errorDescription = 'An unexpected error occurred';

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      oauthError = exceptionResponse.error || oauthError;
      errorDescription =
        exceptionResponse.error_description ||
        exceptionResponse.message ||
        errorDescription;
    }

    response.status(statusCode).json({
      error: oauthError,
      error_description: errorDescription,
    });
  }

  /**
   * Extract human-readable error message
   */
  private extractErrorMessage(
    exceptionResponse: any,
    exception: unknown
  ): string {
    if (!exceptionResponse) {
      return exception instanceof Error
        ? exception.message
        : 'Internal server error';
    }

    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (typeof exceptionResponse === 'object') {
      // Handle validation errors (array of messages)
      if (Array.isArray(exceptionResponse.message)) {
        return exceptionResponse.message.join(', ');
      }

      return (
        exceptionResponse.message ||
        exceptionResponse.error ||
        'An error occurred'
      );
    }

    return 'An error occurred';
  }

  /**
   * Generate error code from status code and exception response
   */
  private generateErrorCode(
    statusCode: number,
    exceptionResponse: any
  ): string {
    // If exception response has a custom error code, use it
    if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      exceptionResponse.code
    ) {
      return exceptionResponse.code;
    }

    // Map common HTTP status codes to error codes
    const errorCodeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };

    return errorCodeMap[statusCode] || `HTTP_${statusCode}`;
  }
}
