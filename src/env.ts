import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
  PRIVATE_DM_TOKEN: { schema: (input) => input },
  IMGPROXY_KEY: { schema: (input) => input },
  IMGPROXY_SALT: { schema: (input) => input },
  IMGPROXY_URL: { schema: (input) => input },
  PUBLIC_MAX_IMAGE_SIZE: { public: true, static: true },
  PRIVATE_DATABASE_URL: { schema: (input) => input },
});
