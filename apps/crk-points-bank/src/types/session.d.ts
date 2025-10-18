import 'express-session';

declare module 'express-session' {
  interface SessionData {
    memberId?: string;
    memberEmail?: string;
    oauthRequest?: {
      clientId: string;
      redirectUri: string;
      responseType: string;
      scope: string;
      state?: string;
    };
  }
}
