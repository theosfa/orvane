import { UnauthorizedException } from '@nestjs/common';

// @nestjs/typeorm и @nestjs/jwt — ESM-only, jest (CommonJS) их не грузит; здесь они не нужны
jest.mock('@nestjs/typeorm', () => ({ InjectRepository: () => () => undefined }));
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

import { AuthService } from './auth.service';

const identity = { googleId: 'g-123', email: 'anna@gmail.com', firstName: 'Anna', lastName: 'Smith' };

function setup() {
  const users = {
    findByGoogleId: jest.fn(),
    findByEmailInsensitive: jest.fn(),
    findByEmail: jest.fn(),
    linkGoogle: jest.fn(),
    create: jest.fn(),
  };
  const jwt = { sign: jest.fn(() => 'access') };
  const refresh = { save: jest.fn(), create: jest.fn((x) => x), delete: jest.fn() };
  const google = { verify: jest.fn().mockResolvedValue(identity), clientId: 'client-id' };
  const service = new AuthService(users as any, jwt as any, refresh as any, google as any);
  return { service, users, google };
}

describe('AuthService.googleSignIn', () => {
  it('signs in a user who already used Google', async () => {
    const { service, users } = setup();
    users.findByGoogleId.mockResolvedValue({ id: 5, email: 'anna@gmail.com' });

    const res = await service.googleSignIn('token');

    expect(res).toMatchObject({ accessToken: 'access', created: false });
    expect(users.create).not.toHaveBeenCalled();
    expect(users.linkGoogle).not.toHaveBeenCalled();
  });

  it('links Google to an existing password account with the same email', async () => {
    const { service, users } = setup();
    users.findByGoogleId.mockResolvedValue(null);
    users.findByEmailInsensitive.mockResolvedValue({ id: 7, email: 'Anna@gmail.com' });

    const res = await service.googleSignIn('token');

    expect(users.findByEmailInsensitive).toHaveBeenCalledWith('anna@gmail.com');
    expect(users.linkGoogle).toHaveBeenCalledWith(7, 'g-123');
    expect(res.created).toBe(false);
  });

  it('creates an account on the first Google sign-in, like a registration', async () => {
    const { service, users } = setup();
    users.findByGoogleId.mockResolvedValue(null);
    users.findByEmailInsensitive.mockResolvedValue(null);
    users.create.mockResolvedValue({ id: 9, email: 'anna@gmail.com' });

    const res = await service.googleSignIn('token', 'uk');

    expect(users.create).toHaveBeenCalledWith('anna@gmail.com', null, 'uk', identity);
    expect(res).toMatchObject({ accessToken: 'access', created: true });
    expect(typeof res.refreshToken).toBe('string');
  });

  it('rejects a bad Google token', async () => {
    const { service, google, users } = setup();
    google.verify.mockRejectedValue(new UnauthorizedException('Invalid Google credential'));

    await expect(service.googleSignIn('junk')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.create).not.toHaveBeenCalled();
  });
});

describe('AuthService.signin for a Google-only account', () => {
  it('refuses a password login when the account has no password', async () => {
    const { service, users } = setup();
    users.findByEmail.mockResolvedValue({ id: 9, email: 'anna@gmail.com', passwordHash: null });

    await expect(service.signin('anna@gmail.com', 'whatever')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
