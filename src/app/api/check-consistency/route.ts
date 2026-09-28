import { CheckConsistencyRequestSchema } from '@/lib/contracts';
import { errorResponse, readRequest } from '@/lib/api-errors';
import { checkConsistency } from '@/lib/brand-service';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readRequest(request, CheckConsistencyRequestSchema);
    return Response.json(await checkConsistency(body.founderData, body.selectedBrand, body.messaging));
  } catch (error) {
    return errorResponse(error);
  }
}
