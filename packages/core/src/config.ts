import { z } from 'zod';
import { addressSchema } from './contracts.js';
export function configuration() {
  return {
    deploymentId:z.string().min(1).max(100).parse(process.env.DEPLOYMENT_ID),
    owner:addressSchema.parse(process.env.DEMO_OWNER_ADDRESS),
    origin:z.url().parse(process.env.PUBLIC_ORIGIN),
    sessionSecret:z.string().min(32).parse(process.env.DEMO_SESSION_SECRET),
  };
}
