import { forwardToApi } from "@/lib/internal-api";

export function DELETE(request: Request) {
  return forwardToApi(request);
}
