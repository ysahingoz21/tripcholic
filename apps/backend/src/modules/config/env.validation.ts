import * as Joi from 'joi';

type EnvVariables = {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  OPTIMIZER_URL: string;
  CORS_ORIGIN: string;
};

const envSchema = Joi.object<EnvVariables>({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  JWT_SECRET: Joi.string().min(16).required(),
  OPTIMIZER_URL: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
  CORS_ORIGIN: Joi.string().min(1).required(),
});

export function validateEnv(config: Record<string, unknown>): EnvVariables {
  const { error, value } = envSchema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: false,
    convert: true,
  });

  if (error) {
    throw new Error(`Environment validation failed: ${error.message}`);
  }

  return value;
}
