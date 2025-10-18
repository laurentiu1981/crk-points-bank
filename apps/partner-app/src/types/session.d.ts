import 'express-session';

declare module 'express-session' {
  interface SessionData {
    accessToken?: string;
    refreshToken?: string;
    member?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      points: number;
    };
    oauthState?: string;
  }
}
