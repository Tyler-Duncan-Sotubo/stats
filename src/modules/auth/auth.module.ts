import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { TokenService } from './token.service';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}), // no global config — TokenService handles per-call
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordResetService,
    TokenService,
    JwtStrategy,
    JwtRefreshStrategy,
  ],
  exports: [TokenService], // available to other modules for generateTempToken
})
export class AuthModule {}
