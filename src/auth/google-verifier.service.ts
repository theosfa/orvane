// auth/google-verifier.service.ts
import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

export type GoogleIdentity = {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
};

// Проверяет ID-токен от кнопки «Sign in with Google»: подпись Google, что токен выдан нашему
// приложению (audience = GOOGLE_CLIENT_ID), не просрочен и email подтверждён.
@Injectable()
export class GoogleVerifier {
  private client = new OAuth2Client();

  // Client ID публичный (он и так виден в коде страницы) — фронт берёт его отсюда, а не из сборки
  get clientId(): string | null {
    return process.env.GOOGLE_CLIENT_ID?.trim() || null;
  }

  async verify(credential: string): Promise<GoogleIdentity> {
    const audience = this.clientId;
    if (!audience) throw new ServiceUnavailableException('Google sign-in is not configured');

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken: credential, audience });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new UnauthorizedException('Google account has no verified email');
    }
    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      firstName: payload.given_name ?? '',
      lastName: payload.family_name ?? '',
    };
  }
}
