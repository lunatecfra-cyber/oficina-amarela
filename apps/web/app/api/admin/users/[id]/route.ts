import { forwardToApi } from "@/lib/internal-api";

export function GET(request: Request) {
  return forwardToApi(request);
}

export function POST(request: Request) {
  return forwardToApi(request);
}

export function DELETE(request: Request) {
  return forwardToApi(request);
}
