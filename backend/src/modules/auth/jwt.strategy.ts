import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface AuthenticatedUser {
    userId: string;
    email: string;
    department: string | null;
    roles: string[];
    permissions: string[];
    branchIds: string[];
}

type JwtPayload = {
    sub?: unknown;
    email?: unknown;
    department?: unknown;
    roles?: unknown;
    permissions?: unknown;
    branchIds?: unknown;
};

function stringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : [];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        const secret = process.env.JWT_SECRET;

        if (!secret) {
            throw new Error('JWT_SECRET is missing from backend/.env');
        }

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret,
        });
    }

    validate(payload: JwtPayload): AuthenticatedUser {
        if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
            throw new UnauthorizedException('Invalid access token');
        }

        return {
            userId: payload.sub,
            email: payload.email,
            department:
                typeof payload.department === 'string' ? payload.department : null,
            roles: stringArray(payload.roles),
            permissions: stringArray(payload.permissions),
            branchIds: stringArray(payload.branchIds),
        };
    }
}