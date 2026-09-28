import { GenerateBrandsRequestSchema } from '@/lib/contracts';
import { errorResponse, readRequest } from '@/lib/api-errors';
import { generateBrands } from '@/lib/brand-service';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readRequest(request, GenerateBrandsRequestSchema);
    return Response.json(await generateBrands(body.founderData));
  } catch (error) {
    return errorResponse(error);
  }
}
