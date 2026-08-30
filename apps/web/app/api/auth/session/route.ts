import { forwardToApi } from "@/lib/internal-api";

export function GET(request: Request) {
  return forwardToApi(request);
}
