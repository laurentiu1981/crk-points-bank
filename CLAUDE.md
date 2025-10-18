# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Points Bank OAuth2.0 Authorization Server** - a monorepo containing:
1. **Points Bank API** (`crk-points-bank`) - OAuth2.0 authorization server that manages member accounts and points
2. **Partner App** (`partner-app`) - Demo OAuth2.0 client application showcasing integration

The Points Bank **IS** the OAuth provider (like Google/GitHub), not an OAuth client. Partner applications integrate with it to authenticate members and access their points data.

## Development Commands

### Docker Development (Recommended)

```bash
# Start all services (PostgreSQL, API, Partner App, Adminer)
docker-compose up -d

# View logs for specific service
docker-compose logs -f api          # Points Bank OAuth server
docker-compose logs -f partner-app  # Partner demo app
docker-compose logs -f postgres     # Database

# Rebuild after dependency changes
docker-compose up --build

# Stop all services
docker-compose down

# Reset everything (including database)
docker-compose down -v
```

### Local Development (Without Docker)

```bash
# Install dependencies
yarn install

# Start only database
docker-compose up -d postgres

# Serve Points Bank API
npx nx serve crk-points-bank

# Serve Partner App
npx nx serve partner-app

# Build for production
npx nx build crk-points-bank
npx nx build partner-app

# Compile SCSS styles (manual)
yarn styles:build

# Watch SCSS for changes
yarn styles:watch:api      # For Points Bank
yarn styles:watch:partner  # For Partner App
```

### Testing & Linting

```bash
# Run tests for Points Bank
npx nx test crk-points-bank

# Run E2E tests
npx nx e2e crk-points-bank-e2e
npx nx e2e partner-app-e2e

# Lint
npx nx lint crk-points-bank
npx nx lint partner-app
```

### Database Access

```bash
# Via Adminer web UI
# http://localhost:8080
# System: PostgreSQL, Server: postgres
# Username: points_admin, Password: dev_password_change_in_production

# Via CLI
docker-compose exec postgres psql -U points_admin -d points_bank
```

## Architecture

### OAuth2.0 Flow Architecture

This system implements **OAuth2.0 Authorization Code Flow** where the Points Bank acts as the authorization server:

1. **Authorization Request** → Partner app redirects member to `/api/oauth/authorize`
2. **Member Authentication** → Session-based login flow (NOT JWT-based initially)
3. **Consent Screen** → Member approves scopes for partner app
4. **Authorization Code** → Short-lived code (5 min) returned to partner
5. **Token Exchange** → Partner exchanges code for access/refresh tokens
6. **Resource Access** → Partner uses access token to fetch member info via `/api/oauth/userinfo`

**Critical Design Decision**: Member authentication happens THROUGH the OAuth flow using express-session, not before it. The login page is integrated into the OAuth flow itself.

### Session vs JWT

- **Express Session**: Used during OAuth authorization flow (login → consent → code generation)
- **JWT**: Used by members for direct API access (not part of OAuth flow in this implementation)
- **OAuth Access Tokens**: Random hex tokens (not JWT) with database-backed validation

### Application Structure

**Points Bank API** (`apps/crk-points-bank/src/`):
- `admin/` - OAuth client registration endpoints (register partner apps)
- `auth/` - Member authentication (register, login, JWT strategy)
- `oauth/` - OAuth2.0 server implementation (authorize, token, userinfo endpoints)
- `entities/` - TypeORM entities (Member, OAuthClient, OAuthAuthorizationCode, OAuthAccessToken, OAuthRefreshToken)
- `views/` - Pug templates (login.pug, consent.pug, register.pug)
- `styles/` - SCSS files compiled to `public/css/`
- `types/` - TypeScript declarations (session extensions)

**Partner App** (`apps/partner-app/src/`):
- `app/` - OAuth client implementation (login flow, callback handler, dashboard)
- `views/` - Pug templates (home.pug, dashboard.pug)
- `styles/` - SCSS files compiled to `public/css/`
- `types/` - TypeScript session type extensions

### Key Entities & Relationships

```
Member (points bank users)
  ├─→ OAuthAccessToken (many) - current active tokens
  ├─→ OAuthRefreshToken (many) - for renewing access tokens
  └─→ OAuthAuthorizationCode (many) - temporary codes during auth flow

OAuthClient (partner applications)
  ├─→ clientId, clientSecret - credentials for partner apps
  ├─→ redirectUris[] - whitelist of allowed callback URLs
  ├─→ allowedScopes[] - which data partner can access (profile, points)
  └─→ allowedGrants[] - supported grant types (authorization_code, refresh_token)
```

### Environment Configuration

**Important variables** (see `.env`):
- `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` - Pre-configured partner credentials for development
- `OAUTH_ACCESS_TOKEN_LIFETIME=3600` - Access tokens last 1 hour
- `OAUTH_REFRESH_TOKEN_LIFETIME=1209600` - Refresh tokens last 14 days
- `OAUTH_AUTHORIZATION_CODE_LIFETIME=300` - Auth codes last 5 minutes
- `SESSION_SECRET` - Used for express-session (OAuth flow state)
- `JWT_SECRET` - Used for member direct API authentication

### Docker Networking

- **API container** → Accessible at `http://localhost:3000` from host
- **Partner App container** → Accessible at `http://localhost:4200` from host
- **Container-to-host communication** → Use `host.docker.internal:3000` (Partner App needs this to call Points Bank API)
- **Inter-container** → Use service names (`postgres:5432`, `api:3000`)

### Styling System

- **Template Engine**: Pug (not HTML)
- **Styles**: SCSS in separate files (not inline CSS)
- **Compilation**: Automatic via `sass --watch` in docker-compose CMD
- **Variables**: Defined in `_variables.scss`, imported by component styles

SCSS watch commands run in background alongside `nx serve` in docker-compose:
```bash
sh -c "yarn styles:watch:api & npx nx serve crk-points-bank --host 0.0.0.0"
```

### TypeORM Entity Loading

**Critical**: Entities MUST be explicitly imported in `app.module.ts`, NOT using path patterns like `__dirname + '/../**/*.entity{.ts,.js}'`. Path patterns fail in this setup.

```typescript
// Correct approach (apps/crk-points-bank/src/app/app.module.ts)
import { Member } from '../entities/member.entity';
import { OAuthClient } from '../entities/oauth-client.entity';
// ... import all entities

TypeOrmModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    entities: [Member, OAuthClient, OAuthAuthorizationCode, ...],
    synchronize: true, // Auto-creates tables in development
  }),
})
```

### Logging Strategy

All OAuth flow components have comprehensive logging:
- **Partner App** (`app.service.ts`) - Logs all outgoing requests to Points Bank (token exchange, member info)
- **Points Bank Controller** (`oauth.controller.ts`) - Logs all OAuth endpoints (authorize, login, consent, token, userinfo)
- **Points Bank Service** (`oauth.service.ts`) - Logs validation, token creation, code generation

Logs show:
- Request URLs and methods
- Payloads (with secrets redacted as `[REDACTED]`)
- Tokens/codes (truncated to first 20 chars)
- Validation steps and outcomes
- Clear section markers (`=== ENDPOINT NAME ===`)

View logs: `docker-compose logs -f api` or `docker-compose logs -f partner-app`

## OAuth2.0 Scopes

| Scope | Access |
|-------|--------|
| `profile` | id, email, firstName, lastName |
| `points` | points balance |

Scopes are space-separated in requests: `scope=profile points`

## Common Development Scenarios

### Adding a New OAuth Client (Partner App)

```bash
curl -X POST http://localhost:3000/api/admin/oauth-clients \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "New Partner App",
    "redirectUris": ["http://localhost:5000/callback"],
    "allowedGrants": ["authorization_code", "refresh_token"],
    "allowedScopes": ["profile", "points"]
  }'
```

Save the returned `clientId` and `clientSecret` - the secret is only shown once.

### Testing OAuth Flow

1. Navigate to Partner App: `http://localhost:4200`
2. Click "Login with Points Bank"
3. You'll be redirected to Points Bank login page
4. Login or register as a member
5. Approve consent for requested scopes
6. Partner App receives authorization code
7. Partner App exchanges code for access token
8. Partner App fetches member info and displays dashboard

### Modifying Entities

After changing entity definitions:
1. Delete database volume: `docker-compose down -v`
2. Restart services: `docker-compose up -d`
3. TypeORM `synchronize: true` will auto-create new schema

For production, use migrations instead of `synchronize`.

### Working with Sessions

Session data is stored in-memory (not persistent across restarts). For production, use a session store like Redis.

Session types are extended in `src/types/session.d.ts`:
```typescript
declare module 'express-session' {
  interface SessionData {
    memberId?: string;
    memberEmail?: string;
    oauthRequest?: { clientId, redirectUri, responseType, scope, state };
  }
}
```

### Import Syntax for express-session

Use default import (NOT `import * as session`):
```typescript
import session from 'express-session';
```

## Monorepo Structure

This is an **Nx monorepo** with two NestJS applications:
- Both apps use the same `Dockerfile.dev`
- Different CMD overrides in `docker-compose.yml`
- Shared `node_modules` via Docker named volume
- Hot reload via volume mounts for source code

### Project Paths

- Apps are in `apps/` folder (NOT root)
- All tsconfig extends use `../../tsconfig.base.json`
- All output dirs use `../../dist/out-tsc`
- Webpack configs reference `../../dist/apps/`

### Named Volumes

`node_modules` is a Docker named volume that persists across rebuilds. If dependencies don't update after `docker-compose up --build`, run `yarn install` inside container manually or delete the volume: `docker volume rm crk-points-bank_node_modules`

## Security Notes

- Client secrets are logged as `[REDACTED]`
- Access tokens/codes are truncated in logs (first 20 chars only)
- Passwords are hashed with bcrypt before storage
- State parameter validation prevents CSRF in OAuth flow
- Redirect URI validation ensures codes only go to registered URLs
- Authorization codes are one-time use (deleted after exchange)
- Access tokens can be revoked via database flag
