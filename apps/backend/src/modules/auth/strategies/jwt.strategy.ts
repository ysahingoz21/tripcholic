import { Injectable } from '@nestjs/common';
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
  constructor(configService: ConfigService) {
    const config = configService.getOrThrow<AppConfig>('app', {
      infer: true,
    });

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.JWT_SECRET,
    });
  }

  validate(payload: JwtAccessTokenPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
    };
  }
}
