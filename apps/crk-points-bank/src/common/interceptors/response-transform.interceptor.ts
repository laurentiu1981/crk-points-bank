import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Response Transform Interceptor
 *
 * Wraps all successful API responses in a standardized format: { data: ... }
 *
 * OAuth2.0 endpoints are excluded to maintain RFC 6749 compliance.
 * Excluded paths: /api/oauth/*
 */
@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  private readonly OAUTH_PATHS = ['/api/oauth'];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const path = request.url?.split('?')[0]; // Remove query params

    // Skip wrapping for OAuth endpoints to maintain OAuth2.0 spec compliance
    if (this.shouldExclude(path)) {
      return next.handle();
    }

    // Wrap response in { data: ... }
    return next.handle().pipe(
      map((data) => {
        // If response is already wrapped (edge case), don't double-wrap
        if (data && typeof data === 'object' && 'data' in data) {
          return data;
        }

        return {
          data,
        };
      })
    );
  }

  private shouldExclude(path: string): boolean {
    if (!path) return false;

    return this.OAUTH_PATHS.some((excludedPath) =>
      path.startsWith(excludedPath)
    );
  }
}
