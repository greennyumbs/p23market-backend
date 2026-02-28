import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '@prisma/client';
export declare class AuthService {
    private usersService;
    private jwtService;
    constructor(usersService: UsersService, jwtService: JwtService);
    validateUser(username: string, pass: string): Promise<Omit<User, 'passwordHash'> | null>;
    login(loginDto: LoginDto): Promise<{
        token: string;
        user: {
            id: string;
            username: string;
            displayName: string;
            avatarIndex: number;
            role: string;
        };
    }>;
    register(registerDto: RegisterDto): Promise<{
        token: string;
        user: {
            id: string;
            username: string;
            displayName: string;
            avatarIndex: number;
            role: string;
        };
    }>;
}
