import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('HRMS Payroll Dashboard'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3004'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3002'),
  NEXT_PUBLIC_DEFAULT_WORKSPACE_ID: z.string().default('f47ac10b-58cc-4372-a567-0e02b2c3d479'),
  NEXT_PUBLIC_DEFAULT_WORKSPACE_NAME: z.string().default('Urgent Manpower Workspace'),
  NEXT_PUBLIC_DEV_AUTH_TOKEN: z.string().optional(),
});

const parseClientEnv = () => {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_NAME: process.env['NEXT_PUBLIC_APP_NAME'],
    NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'],
    NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'],
    NEXT_PUBLIC_DEFAULT_WORKSPACE_ID: process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_ID'],
    NEXT_PUBLIC_DEFAULT_WORKSPACE_NAME: process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_NAME'],
  });

  if (!result.success) {
    const formattedErrors = JSON.stringify(result.error.format(), null, 2);
    throw new Error(`❌ Invalid client environment variables:\n${formattedErrors}`);
  }

  return result.data;
};

export const clientEnv = parseClientEnv();
// fallow-ignore-next-line unused-type
export type ClientEnv = z.infer<typeof clientEnvSchema>;
