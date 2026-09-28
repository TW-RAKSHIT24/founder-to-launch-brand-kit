import type { ApiClient } from '@/api/types';
import { routeClient } from '@/api/route-client';

export const api: ApiClient = routeClient;
export type { ApiClient } from '@/api/types';
