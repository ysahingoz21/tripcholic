import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { type AppConfig } from '../../config/app.config';
import {
  type AuthenticatedUser,
  type JwtAccessTokenPayload,
} from '../types/authenticated-user.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(configService: ConfigService) {
    const config = configService.getOrThrow<AppConfig>('app', {
      infer: true,
    });

    const logger = new Logger(JwtStrategy.name);
    logger.log(
      `[AUTH_DEBUG] JwtStrategy init jwtSecretPresent=${Boolean(config.JWT_SECRET)} jwtSecretLength=${config.JWT_SECRET.length}`,
    );

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.JWT_SECRET,
    });
  }

  validate(payload: JwtAccessTokenPayload): AuthenticatedUser {
    this.logger.log(
      `[AUTH_DEBUG] JwtStrategy validate sub=${payload.sub} email=${payload.email}`,
    );
    return {
      id: payload.sub,
      email: payload.email,
    };
  }
}
