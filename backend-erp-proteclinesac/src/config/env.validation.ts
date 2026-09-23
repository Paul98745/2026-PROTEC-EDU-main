import Joi from 'joi';

export function validateEnvironment(config: Record<string, unknown>) {
  const { error, value } = Joi.object({
    NODE_ENV: Joi.string()
      .valid('development', 'test', 'production')
      .default('development'),
    PORT: Joi.number().port().default(3000),
    DATABASE_URL: Joi.string()
      .uri({ scheme: ['postgres', 'postgresql'] })
      .optional()
      .allow(''),
    FRONTEND_ORIGIN: Joi.string().uri().default('http://localhost:4200'),
    SESSION_COOKIE_NAME: Joi.string()
      .pattern(/^[A-Za-z0-9_]+$/)
      .default('protecedu_session'),
    APP_PUBLIC_URL: Joi.string().uri().when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    SMTP_HOST: Joi.string().hostname().when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    SMTP_PORT: Joi.number().port().default(587),
    SMTP_USER: Joi.string().when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    SMTP_PASSWORD: Joi.string().when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    SMTP_FROM: Joi.string().email().when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  })
    .unknown(true)
    .validate(config, { abortEarly: false, convert: true });

  if (error) {
    throw new Error(`Invalid environment configuration: ${error.message}`);
  }

  return value;
}
