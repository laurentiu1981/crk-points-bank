# Points Bank - OAuth2.0 Authorization Server

A complete OAuth2.0 authorization server built with NestJS, TypeORM, and PostgreSQL. This system allows members to manage their points and partner applications to integrate using the OAuth2.0 Authorization Code flow.

## Features

- **Member Authentication**: Email/password registration and login with JWT
- **OAuth2.0 Server**: Full Authorization Code flow with refresh tokens
- **Points Management**: Track member points balances
- **Partner Integration**: OAuth clients can request access to member data
- **Database**: PostgreSQL with TypeORM
- **Docker Support**: Complete Docker Compose setup for local development
- **API Documentation**: RESTful API with comprehensive endpoints

## Tech Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL 16
- **ORM**: TypeORM
- **Authentication**: Passport, JWT, bcrypt
- **Runtime**: Node.js 22 (LTS)
- **Package Manager**: Yarn
- **Monorepo**: Nx 21

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 22+ (if running locally without Docker)
- Yarn

### 1. Start All Services with Docker

The easiest way to get started is using Docker Compose, which will start the database, API, and Adminer:

```bash
docker-compose up -d
```

This will start:
- **PostgreSQL** on port 5432
- **API Server** on port 3000 (http://localhost:3000/api)
- **Adminer** (Database UI) on port 8080 (http://localhost:8080)

The API will be available at: `http://localhost:3000/api`

### 2. Check Service Status

```bash
docker-compose ps
```

### 3. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f postgres
```

### 4. Stop Services

```bash
docker-compose down
```

To remove volumes as well:
```bash
docker-compose down -v
```

## Development

### Local Development (Without Docker)

If you prefer to run the API locally:

```bash
# Start only the database
docker-compose up -d postgres

# Install dependencies
yarn install

# Start the API in development mode
npx nx serve crk-points-bank
```

### Hot Reload

When using `docker-compose up`, the source code is mounted as a volume, so changes will automatically trigger a rebuild and restart.

### Database Access

**Via Adminer (Web UI):**
- URL: http://localhost:8080
- System: PostgreSQL
- Server: postgres
- Username: points_admin
- Password: dev_password_change_in_production
- Database: points_bank

**Via CLI:**
```bash
docker-compose exec postgres psql -U points_admin -d points_bank
```

## API Documentation

### Base URL

```
http://localhost:3000/api
```

### Authentication Endpoints

#### 1. Register a New Member

```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "points": 0,
  "active": true,
  "createdAt": "2025-01-18T12:00:00.000Z",
  "updatedAt": "2025-01-18T12:00:00.000Z"
}
```

#### 2. Member Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "member": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "points": 0
  }
}
```

#### 3. Get Member Profile

```bash
GET /api/auth/profile
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

### Admin Endpoints

#### 1. Register a Partner Application (OAuth Client)

```bash
POST /api/admin/oauth-clients
Content-Type: application/json

{
  "clientName": "Partner Shopping App",
  "redirectUris": [
    "http://localhost:4200/callback",
    "https://partner-app.com/callback"
  ],
  "allowedGrants": ["authorization_code", "refresh_token"],
  "allowedScopes": ["profile", "points"],
  "description": "Partner shopping application",
  "logoUrl": "https://partner-app.com/logo.png"
}
```

**Response (SAVE THESE CREDENTIALS):**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "clientId": "a1b2c3d4e5f6789012345678",
  "clientSecret": "x1y2z3w4v5u6t7s8r9q0p1o2n3m4l5k6",
  "clientName": "Partner Shopping App",
  "redirectUris": [
    "http://localhost:4200/callback",
    "https://partner-app.com/callback"
  ],
  "allowedGrants": ["authorization_code", "refresh_token"],
  "allowedScopes": ["profile", "points"],
  "description": "Partner shopping application",
  "logoUrl": "https://partner-app.com/logo.png",
  "active": true,
  "createdAt": "2025-01-18T12:00:00.000Z",
  "updatedAt": "2025-01-18T12:00:00.000Z"
}
```

#### 2. List All OAuth Clients

```bash
GET /api/admin/oauth-clients
```

#### 3. Get Client by ID

```bash
GET /api/admin/oauth-clients/:id
```

#### 4. Deactivate Client

```bash
PATCH /api/admin/oauth-clients/:id/deactivate
```

#### 5. Activate Client

```bash
PATCH /api/admin/oauth-clients/:id/activate
```

### OAuth2.0 Flow

#### Step 1: Authorization Request

The partner application redirects the member to:

```
GET /api/oauth/authorize?client_id=<CLIENT_ID>&redirect_uri=<REDIRECT_URI>&response_type=code&scope=profile points&state=<RANDOM_STATE>
```

**Parameters:**
- `client_id`: The OAuth client ID from registration
- `redirect_uri`: Must match one of the registered redirect URIs
- `response_type`: Must be `code`
- `scope`: Space-separated scopes (e.g., `profile points`)
- `state`: Random string for CSRF protection

**Important:** The member must be authenticated (have a valid JWT token). They should login first via `/api/auth/login` if not already logged in.

**Redirect Response:**
The member will be redirected back to the partner app:
```
https://partner-app.com/callback?code=<AUTHORIZATION_CODE>&state=<STATE>
```

#### Step 2: Exchange Authorization Code for Access Token

```bash
POST /api/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "<AUTHORIZATION_CODE>",
  "redirect_uri": "<SAME_REDIRECT_URI>",
  "client_id": "<CLIENT_ID>",
  "client_secret": "<CLIENT_SECRET>"
}
```

**Response:**
```json
{
  "access_token": "a1b2c3d4e5f6789012345678",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "x1y2z3w4v5u6t7s8r9q0p1o2n3m4l5k6",
  "scope": "profile points"
}
```

#### Step 3: Access Protected Resources

```bash
GET /api/oauth/userinfo
Authorization: Bearer <ACCESS_TOKEN>
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "points": 100
}
```

The response includes different fields based on the granted scopes:
- `profile` scope: id, email, firstName, lastName
- `points` scope: points balance

#### Step 4: Refresh Access Token

```bash
POST /api/oauth/token
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "refresh_token": "<REFRESH_TOKEN>",
  "client_id": "<CLIENT_ID>",
  "client_secret": "<CLIENT_SECRET>"
}
```

**Response:**
```json
{
  "access_token": "new_access_token_here",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "new_refresh_token_here",
  "scope": "profile points"
}
```

## Database Schema

### Members
Stores points bank member accounts.

| Column     | Type         | Description                    |
|------------|--------------|--------------------------------|
| id         | UUID         | Primary key                    |
| email      | VARCHAR      | Unique email address           |
| password   | VARCHAR      | Hashed password (bcrypt)       |
| firstName  | VARCHAR      | Member's first name            |
| lastName   | VARCHAR      | Member's last name             |
| points     | DECIMAL(10,2)| Points balance                 |
| active     | BOOLEAN      | Account active status          |
| createdAt  | TIMESTAMP    | Creation timestamp             |
| updatedAt  | TIMESTAMP    | Last update timestamp          |

### OAuth Clients
Registered partner applications.

| Column         | Type      | Description                      |
|----------------|-----------|----------------------------------|
| id             | UUID      | Primary key                      |
| clientId       | VARCHAR   | Unique client identifier         |
| clientSecret   | VARCHAR   | Client secret                    |
| clientName     | VARCHAR   | Application name                 |
| redirectUris   | TEXT[]    | Allowed redirect URIs            |
| allowedGrants  | VARCHAR[] | Allowed grant types              |
| allowedScopes  | VARCHAR[] | Allowed scopes                   |
| description    | TEXT      | Application description          |
| logoUrl        | TEXT      | Application logo URL             |
| active         | BOOLEAN   | Client active status             |
| createdAt      | TIMESTAMP | Creation timestamp               |
| updatedAt      | TIMESTAMP | Last update timestamp            |

### OAuth Authorization Codes
Temporary codes exchanged for access tokens.

| Column            | Type      | Description                  |
|-------------------|-----------|------------------------------|
| id                | UUID      | Primary key                  |
| authorizationCode | VARCHAR   | Unique code                  |
| expiresAt         | TIMESTAMP | Expiration time              |
| redirectUri       | VARCHAR   | Redirect URI                 |
| scope             | VARCHAR[] | Granted scopes               |
| clientId          | UUID      | Foreign key to oauth_clients |
| memberId          | UUID      | Foreign key to members       |
| createdAt         | TIMESTAMP | Creation timestamp           |

### OAuth Access Tokens
Active access tokens for API access.

| Column               | Type      | Description                  |
|----------------------|-----------|------------------------------|
| id                   | UUID      | Primary key                  |
| accessToken          | VARCHAR   | Unique token                 |
| accessTokenExpiresAt | TIMESTAMP | Expiration time              |
| scope                | VARCHAR[] | Granted scopes               |
| clientId             | UUID      | Foreign key to oauth_clients |
| memberId             | UUID      | Foreign key to members       |
| revoked              | BOOLEAN   | Token revoked status         |
| createdAt            | TIMESTAMP | Creation timestamp           |

### OAuth Refresh Tokens
Refresh tokens for obtaining new access tokens.

| Column                 | Type      | Description                  |
|------------------------|-----------|------------------------------|
| id                     | UUID      | Primary key                  |
| refreshToken           | VARCHAR   | Unique token                 |
| refreshTokenExpiresAt  | TIMESTAMP | Expiration time              |
| scope                  | VARCHAR[] | Granted scopes               |
| clientId               | UUID      | Foreign key to oauth_clients |
| memberId               | UUID      | Foreign key to members       |
| revoked                | BOOLEAN   | Token revoked status         |
| createdAt              | TIMESTAMP | Creation timestamp           |

## Configuration

All configuration is managed through environment variables. The `.env` file has been created with development defaults.

### Environment Variables

| Variable                          | Default Value                           | Description                    |
|-----------------------------------|-----------------------------------------|--------------------------------|
| DB_HOST                           | localhost                               | Database host                  |
| DB_PORT                           | 5432                                    | Database port                  |
| DB_USERNAME                       | points_admin                            | Database username              |
| DB_PASSWORD                       | dev_password_change_in_production       | Database password              |
| DB_DATABASE                       | points_bank                             | Database name                  |
| JWT_SECRET                        | dev-jwt-secret-please-change-in-production | JWT signing secret        |
| JWT_EXPIRATION                    | 1d                                      | JWT expiration                 |
| OAUTH_ACCESS_TOKEN_LIFETIME       | 3600                                    | Access token lifetime (seconds)|
| OAUTH_REFRESH_TOKEN_LIFETIME      | 1209600                                 | Refresh token lifetime (14 days)|
| OAUTH_AUTHORIZATION_CODE_LIFETIME | 300                                     | Auth code lifetime (5 minutes) |
| NODE_ENV                          | development                             | Environment                    |
| PORT                              | 3000                                    | API server port                |
| FRONTEND_URL                      | http://localhost:4200                   | Frontend URL for CORS          |
| SESSION_SECRET                    | dev-session-secret-please-change-in-production | Session secret        |

### Production Configuration

For production, update these critical values in `.env`:
- `DB_PASSWORD`: Use a strong, random password
- `JWT_SECRET`: Use a cryptographically secure random string
- `SESSION_SECRET`: Use a cryptographically secure random string
- `NODE_ENV`: Set to `production`
- Enable HTTPS and update URLs accordingly

## Available Scopes

| Scope    | Description                                      |
|----------|--------------------------------------------------|
| profile  | Access to basic profile (id, email, name)        |
| points   | Access to member's points balance                |

## Security Considerations

1. **HTTPS Required**: Always use HTTPS in production
2. **Secure Secrets**: Generate strong, random secrets for production
3. **CORS**: Configure CORS properly for your frontend application
4. **Rate Limiting**: Implement rate limiting in production
5. **Client Secrets**: Never expose client secrets in frontend code
6. **State Parameter**: Always use and validate the state parameter to prevent CSRF attacks
7. **Redirect URI Validation**: Only register trusted redirect URIs
8. **Token Storage**: Store access tokens securely (never in localStorage for web apps)

## Testing

Run tests:
```bash
npx nx test crk-points-bank
```

Run linting:
```bash
npx nx lint crk-points-bank
```

Run e2e tests:
```bash
npx nx e2e crk-points-bank-e2e
```

## Project Structure

```
crk-points-bank/
├── apps/
│   ├── crk-points-bank/           # Main NestJS application
│   │   └── src/
│   │       ├── admin/             # Admin endpoints (OAuth client management)
│   │       ├── auth/              # Member authentication
│   │       ├── entities/          # TypeORM entities
│   │       ├── oauth/             # OAuth2.0 server implementation
│   │       └── app/               # App module and base controller
│   └── crk-points-bank-e2e/       # E2E tests
├── docker-compose.yml             # Docker Compose configuration
├── Dockerfile.dev                 # Development Dockerfile
├── .env                           # Environment variables
├── .env.example                   # Example environment variables
└── README.md                      # This file
```

## Troubleshooting

### Docker Issues

**Container won't start:**
```bash
docker-compose down -v
docker-compose up --build
```

**View container logs:**
```bash
docker-compose logs api
```

**Connect to container:**
```bash
docker-compose exec api sh
```

### Database Issues

**Reset database:**
```bash
docker-compose down -v
docker-compose up -d
```

**Check database connection:**
```bash
docker-compose exec postgres psql -U points_admin -d points_bank -c "SELECT 1;"
```

### API Issues

**Check if API is running:**
```bash
curl http://localhost:3000/api
```

**Rebuild node_modules:**
```bash
docker-compose down
docker volume rm crk-points-bank_node_modules
docker-compose up --build
```

## License

MIT

## Support

For issues and questions, please open an issue on the GitHub repository.
