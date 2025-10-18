# Points Redemption API

This document describes the two approaches for redeeming points from member accounts.

## Overview

The Points Bank API supports two redemption methods:

1. **Direct Redemption** - Partner uses member's OAuth access token to redeem points immediately
2. **OTP-based Redemption** - Partner initiates request, member approves via OTP

## Base URL

```
http://localhost:3000/api
```

## Approach 1: Direct Redemption with Access Token

This approach allows partners to redeem points directly using the member's OAuth access token. The member has already granted consent via the OAuth flow.

### Prerequisites

- Member must have completed OAuth authorization flow
- Partner must have a valid OAuth access token with `points` scope
- Access token is valid for 1 hour (3600 seconds)

### Endpoint

```
POST /api/points/redeem
```

### Headers

```
Authorization: Bearer <OAUTH_ACCESS_TOKEN>
Content-Type: application/json
```

### Request Body

```json
{
  "amount": 50,
  "description": "Purchase of Premium Widget"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | number | Yes | Points to redeem (must be positive) |
| description | string | No | Purpose of redemption |

### Response (Success - 200)

```json
{
  "success": true,
  "newBalance": 150,
  "transactionId": "1234567890-550e8400",
  "redeemedAmount": 50,
  "client": {
    "id": "a1b2c3d4e5f6789012345678",
    "name": "Partner Shopping App"
  }
}
```

### Response (Error - 400)

```json
{
  "statusCode": 400,
  "message": "Insufficient points. You have 30 points but need 50",
  "error": "Bad Request"
}
```

### Example Usage

```bash
# Using curl
curl -X POST http://localhost:3000/api/points/redeem \
  -H "Authorization: Bearer abc123...xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50,
    "description": "Premium Widget Purchase"
  }'
```

```javascript
// Using axios (Partner App)
const response = await axios.post(
  'http://localhost:3000/api/points/redeem',
  {
    amount: 50,
    description: 'Premium Widget Purchase'
  },
  {
    headers: {
      Authorization: `Bearer ${memberAccessToken}`,
      'Content-Type': 'application/json'
    }
  }
);

console.log('New balance:', response.data.newBalance);
```

### Error Scenarios

| Error | Cause | Solution |
|-------|-------|----------|
| Missing or invalid authorization header | No Bearer token provided | Include valid OAuth access token |
| Access token does not have permission | Token missing `points` scope | Request OAuth authorization with `points` scope |
| Invalid access token | Token expired or revoked | Refresh token or re-authenticate |
| Insufficient points | Member doesn't have enough points | Check balance before redeeming |
| Redemption amount must be positive | Amount <= 0 | Use positive amount |

---

## Approach 2: OTP-based Redemption Request

This approach requires explicit member approval via OTP for each redemption. Best for high-value transactions or when you don't have the member's access token.

### Flow Overview

1. Partner creates redemption request → System generates OTP
2. Member receives OTP (in demo: returned in response; in production: sent via SMS/Email)
3. Member approves/rejects using OTP
4. Points are redeemed upon approval

### Step 1: Create Redemption Request

#### Endpoint

```
POST /api/points/redemption-request
```

#### Headers

```
Content-Type: application/json
```

#### Request Body

```json
{
  "client_id": "a1b2c3d4e5f6789012345678",
  "client_secret": "x1y2z3w4v5u6t7s8r9q0p1o2n3m4l5k6",
  "member_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 100,
  "description": "VIP Package Purchase"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| client_id | string | Yes | OAuth client ID |
| client_secret | string | Yes | OAuth client secret |
| member_id | string | Yes | Member's UUID |
| amount | number | Yes | Points to redeem |
| description | string | No | Purpose of redemption |

#### Response (Success - 200)

```json
{
  "success": true,
  "requestId": "660e8400-e29b-41d4-a716-446655440000",
  "otp": "123456",
  "expiresAt": "2025-10-18T15:30:00.000Z",
  "message": "Redemption request created. Member must approve with OTP within 10 minutes."
}
```

**Note**: In production, `otp` should NOT be in the response. It should be sent via SMS/Email to the member.

#### Example Usage

```bash
curl -X POST http://localhost:3000/api/points/redemption-request \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "a1b2c3d4e5f6789012345678",
    "client_secret": "x1y2z3w4v5u6t7s8r9q0p1o2n3m4l5k6",
    "member_id": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 100,
    "description": "VIP Package Purchase"
  }'
```

```javascript
// Partner App - Create redemption request
const response = await axios.post(
  'http://localhost:3000/api/points/redemption-request',
  {
    client_id: process.env.OAUTH_CLIENT_ID,
    client_secret: process.env.OAUTH_CLIENT_SECRET,
    member_id: memberId,
    amount: 100,
    description: 'VIP Package Purchase'
  }
);

console.log('Request ID:', response.data.requestId);
console.log('OTP (demo only):', response.data.otp);
console.log('Expires at:', response.data.expiresAt);
```

### Step 2: Member Views Pending Requests

#### Endpoint

```
GET /api/points/redemption/pending
```

#### Headers

```
Authorization: Bearer <MEMBER_JWT_TOKEN>
```

**Note**: This uses the member's JWT token from `/api/auth/login`, NOT the OAuth access token.

#### Response (Success - 200)

```json
{
  "pendingRequests": [
    {
      "requestId": "660e8400-e29b-41d4-a716-446655440000",
      "amount": 100,
      "description": "VIP Package Purchase",
      "partnerName": "Partner Shopping App",
      "createdAt": "2025-10-18T15:20:00.000Z",
      "expiresAt": "2025-10-18T15:30:00.000Z"
    }
  ]
}
```

#### Example Usage

```bash
curl -X GET http://localhost:3000/api/points/redemption/pending \
  -H "Authorization: Bearer <MEMBER_JWT_TOKEN>"
```

### Step 3: Member Approves Request

#### Endpoint

```
POST /api/points/redemption/approve
```

#### Headers

```
Authorization: Bearer <MEMBER_JWT_TOKEN>
Content-Type: application/json
```

#### Request Body

```json
{
  "request_id": "660e8400-e29b-41d4-a716-446655440000",
  "otp": "123456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| request_id | string | Yes | Redemption request UUID |
| otp | string | Yes | 6-digit OTP code |

#### Response (Success - 200)

```json
{
  "success": true,
  "newBalance": 100,
  "transactionId": "660e8400-e29b-41d4-a716-446655440000",
  "message": "Points redeemed successfully"
}
```

#### Example Usage

```bash
curl -X POST http://localhost:3000/api/points/redemption/approve \
  -H "Authorization: Bearer <MEMBER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "660e8400-e29b-41d4-a716-446655440000",
    "otp": "123456"
  }'
```

```javascript
// Member approves redemption
const response = await axios.post(
  'http://localhost:3000/api/points/redemption/approve',
  {
    request_id: requestId,
    otp: otpCode
  },
  {
    headers: {
      Authorization: `Bearer ${memberJwtToken}`,
      'Content-Type': 'application/json'
    }
  }
);

console.log('Points redeemed! New balance:', response.data.newBalance);
```

### Step 3 (Alternative): Member Rejects Request

#### Endpoint

```
POST /api/points/redemption/reject
```

#### Headers

```
Authorization: Bearer <MEMBER_JWT_TOKEN>
Content-Type: application/json
```

#### Request Body

```json
{
  "request_id": "660e8400-e29b-41d4-a716-446655440000"
}
```

#### Response (Success - 200)

```json
{
  "success": true,
  "message": "Redemption request rejected"
}
```

#### Example Usage

```bash
curl -X POST http://localhost:3000/api/points/redemption/reject \
  -H "Authorization: Bearer <MEMBER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "660e8400-e29b-41d4-a716-446655440000"
  }'
```

---

## OTP Details

- **Format**: 6-digit numeric code (100000-999999)
- **Lifetime**: 10 minutes
- **Generation**: Cryptographically secure random
- **Single-use**: Request is marked as completed after approval/rejection
- **Production**: Should be sent via SMS/Email, not returned in API response

---

## Redemption Request States

| State | Description |
|-------|-------------|
| pending | Awaiting member approval |
| approved | Member approved, points redeemed |
| rejected | Member rejected the request |
| expired | OTP expired (10+ minutes old) |

---

## Token Comparison

| Token Type | Purpose | Lifetime | Used For |
|------------|---------|----------|----------|
| OAuth Access Token | Partner API access | 1 hour | Direct redemption (Approach 1) |
| Member JWT Token | Member authentication | 1 day | OTP approval (Approach 2) |
| OAuth Refresh Token | Renew access token | 14 days | Getting new access tokens |

---

## Complete Example: Partner App Integration

### Approach 1: Direct Redemption

```javascript
// Partner app - Direct redemption flow
async function redeemPointsDirect(memberAccessToken, amount, description) {
  try {
    const response = await axios.post(
      'http://localhost:3000/api/points/redeem',
      { amount, description },
      {
        headers: {
          Authorization: `Bearer ${memberAccessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      newBalance: response.data.newBalance,
      transactionId: response.data.transactionId
    };
  } catch (error) {
    console.error('Redemption failed:', error.response?.data?.message);
    throw error;
  }
}

// Usage
await redeemPointsDirect(accessToken, 50, 'Premium Widget');
```

### Approach 2: OTP-based Redemption

```javascript
// Partner app - Create redemption request
async function createRedemptionRequest(memberId, amount, description) {
  try {
    const response = await axios.post(
      'http://localhost:3000/api/points/redemption-request',
      {
        client_id: process.env.OAUTH_CLIENT_ID,
        client_secret: process.env.OAUTH_CLIENT_SECRET,
        member_id: memberId,
        amount,
        description
      }
    );

    console.log('Redemption request created!');
    console.log('Request ID:', response.data.requestId);
    console.log('OTP sent to member (demo):', response.data.otp);

    return response.data.requestId;
  } catch (error) {
    console.error('Request creation failed:', error.response?.data?.message);
    throw error;
  }
}

// Member app - Approve redemption
async function approvRedemption(memberJwtToken, requestId, otp) {
  try {
    const response = await axios.post(
      'http://localhost:3000/api/points/redemption/approve',
      { request_id: requestId, otp },
      {
        headers: {
          Authorization: `Bearer ${memberJwtToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      newBalance: response.data.newBalance
    };
  } catch (error) {
    console.error('Approval failed:', error.response?.data?.message);
    throw error;
  }
}
```

---

## Security Considerations

### Approach 1 (Direct Redemption)

✅ **Advantages**:
- Faster (no OTP step)
- Better user experience
- Member already consented via OAuth

⚠️ **Considerations**:
- Access token must be securely stored
- Token has 1-hour lifetime
- Requires `points` scope

### Approach 2 (OTP-based)

✅ **Advantages**:
- Explicit approval for each transaction
- No need to store member tokens
- Better for high-value transactions
- Member can review request before approving

⚠️ **Considerations**:
- Slower (requires member action)
- OTP delivery required (SMS/Email)
- 10-minute time window

---

## Testing the APIs

### Setup

1. Start services: `docker-compose up -d`
2. Register a member: `POST /api/auth/register`
3. Register OAuth client: `POST /api/admin/oauth-clients`
4. Complete OAuth flow to get access token
5. Add some test points to member account (database or future API)

### Test Approach 1

```bash
# Direct redemption
curl -X POST http://localhost:3000/api/points/redeem \
  -H "Authorization: Bearer YOUR_OAUTH_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10, "description": "Test purchase"}'
```

### Test Approach 2

```bash
# 1. Create redemption request
curl -X POST http://localhost:3000/api/points/redemption-request \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "member_id": "MEMBER_UUID",
    "amount": 10,
    "description": "Test VIP purchase"
  }'

# Save the requestId and otp from response

# 2. Approve with OTP
curl -X POST http://localhost:3000/api/points/redemption/approve \
  -H "Authorization: Bearer YOUR_MEMBER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "REQUEST_UUID",
    "otp": "123456"
  }'
```

---

## Troubleshooting

### "Insufficient points"
- Check member balance before redemption
- Ensure amount is not greater than current points

### "Access token does not have permission"
- OAuth flow must request `points` scope
- Re-authenticate with correct scopes

### "Invalid OTP"
- OTP is case-sensitive (numeric only)
- Check OTP hasn't expired (10 min lifetime)
- Ensure using correct requestId

### "Member not found"
- Verify member UUID is correct
- Check member account is active

### "Client not found"
- Verify client credentials are correct
- Check client is active in database
