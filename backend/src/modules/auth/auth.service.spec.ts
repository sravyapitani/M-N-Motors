import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';

describe('AuthService & LoginDto Regression Tests', () => {
  const samplePasswordHash = bcrypt.hashSync('Password123!', 4);

  const sampleUser = {
    id: 'user-admin-1',
    email: 'admin@nexus.local',
    firstName: 'Suresh',
    lastName: 'Achanta',
    passwordHash: samplePasswordHash,
    department: 'FINANCE',
    isActive: true,
    roles: [
      {
        role: {
          key: 'SYSTEM_ADMIN',
          permissions: [{ permission: { key: 'SYSTEM_ADMIN' } }],
        },
      },
    ],
    branchAccess: [
      {
        branch: { id: 'branch-1', code: 'MUM', name: 'Mumbai' },
      },
    ],
  };

  const mockJwtService: any = {
    signAsync: async (payload: any) => `mock-token-for-${payload.sub}`,
  };

  it('should reject missing or undefined email with UnauthorizedException (never 500 TypeError)', async () => {
    const mockPrisma: any = { user: { findUnique: async () => null } };
    const service = new AuthService(mockPrisma, mockJwtService);

    await assert.rejects(
      async () => {
        await service.login(undefined as any, 'somePassword');
      },
      (err: any) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.strictEqual(err.message, 'Invalid email or password');
        return true;
      },
    );
  });

  it('should reject whitespace-only or empty email with UnauthorizedException', async () => {
    const mockPrisma: any = { user: { findUnique: async () => null } };
    const service = new AuthService(mockPrisma, mockJwtService);

    await assert.rejects(
      async () => {
        await service.login('   ', 'somePassword');
      },
      (err: any) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.strictEqual(err.message, 'Invalid email or password');
        return true;
      },
    );
  });

  it('should reject missing or undefined password with UnauthorizedException (never 500 error)', async () => {
    const mockPrisma: any = { user: { findUnique: async () => sampleUser } };
    const service = new AuthService(mockPrisma, mockJwtService);

    await assert.rejects(
      async () => {
        await service.login('admin@nexus.local', undefined as any);
      },
      (err: any) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.strictEqual(err.message, 'Invalid email or password');
        return true;
      },
    );
  });

  it('should reject non-existent user with UnauthorizedException', async () => {
    const mockPrisma: any = {
      user: {
        findUnique: async () => null,
      },
    };
    const service = new AuthService(mockPrisma, mockJwtService);

    await assert.rejects(
      async () => {
        await service.login('unknown@nexus.local', 'Password123!');
      },
      (err: any) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.strictEqual(err.message, 'Invalid email or password');
        return true;
      },
    );
  });

  it('should reject incorrect password with UnauthorizedException', async () => {
    const mockPrisma: any = {
      user: {
        findUnique: async () => sampleUser,
      },
    };
    const service = new AuthService(mockPrisma, mockJwtService);

    await assert.rejects(
      async () => {
        await service.login('admin@nexus.local', 'WrongPassword!');
      },
      (err: any) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.strictEqual(err.message, 'Invalid email or password');
        return true;
      },
    );
  });

  it('should successfully log in with valid credentials and return JWT & user details', async () => {
    const mockPrisma: any = {
      user: {
        findUnique: async () => sampleUser,
      },
    };
    const service = new AuthService(mockPrisma, mockJwtService);

    const result = await service.login('admin@nexus.local', 'Password123!');

    assert.ok(result.accessToken);
    assert.strictEqual(result.tokenType, 'Bearer');
    assert.strictEqual(result.user.email, 'admin@nexus.local');
    assert.deepStrictEqual(result.user.roles, ['SYSTEM_ADMIN']);
    assert.strictEqual(result.user.branches.length, 1);
  });

  it('should validate LoginDto and reject missing or invalid email', async () => {
    const invalidDto = plainToInstance(LoginDto, {
      email: 'not-an-email',
      password: '',
    });
    const errors = await validate(invalidDto);

    assert.strictEqual(errors.length, 2);
    const emailError = errors.find((e) => e.property === 'email');
    const passwordError = errors.find((e) => e.property === 'password');
    assert.ok(emailError);
    assert.ok(passwordError);
  });

  it('should validate LoginDto successfully with valid inputs', async () => {
    const validDto = plainToInstance(LoginDto, {
      email: 'admin@nexus.local',
      password: 'Password123!',
    });
    const errors = await validate(validDto);

    assert.strictEqual(errors.length, 0);
  });
});
