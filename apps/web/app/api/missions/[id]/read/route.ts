import { forwardToApi } from "@/lib/internal-api";

export function POST(request: Request) {
  return forwardToApi(request);
}
