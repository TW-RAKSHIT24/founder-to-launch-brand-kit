import { RefineBrandRequestSchema } from '@/lib/contracts';
import { errorResponse, readRequest } from '@/lib/api-errors';
import { refineBrand } from '@/lib/brand-service';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readRequest(request, RefineBrandRequestSchema);
    return Response.json(await refineBrand(body.founderData, body.selectedBrand));
  } catch (error) {
    return errorResponse(error);
  }
}
