import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
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
    logout(): {
        ok: boolean;
    };
}
