import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) { }

    async login(email?: string, password?: string) {
        if (
            !email ||
            typeof email !== 'string' ||
            !email.trim() ||
            !password ||
            typeof password !== 'string'
        ) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: { permission: true },
                                },
                            },
                        },
                    },
                },
                branchAccess: {
                    include: { branch: true },
                },
            },
        });

        if (
            !user ||
            !user.isActive ||
            !user.passwordHash ||
            !(await bcrypt.compare(password, user.passwordHash))
        ) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const roles = user.roles.map(({ role }) => role.key);
        const permissions = [
            ...new Set(
                user.roles.flatMap(({ role }) =>
                    role.permissions.map(({ permission }) => permission.key),
                ),
            ),
        ];
        const branches = user.branchAccess.map(({ branch }) => ({
            id: branch.id,
            code: branch.code,
            name: branch.name,
        }));

        const accessToken = await this.jwtService.signAsync({
            sub: user.id,
            email: user.email,
            department: user.department,
            roles,
            permissions,
            branchIds: branches.map((branch) => branch.id),
        });

        return {
            accessToken,
            tokenType: 'Bearer',
            expiresInSeconds: 900,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                department: user.department,
                roles,
                permissions,
                branches,
            },
        };
    }
}