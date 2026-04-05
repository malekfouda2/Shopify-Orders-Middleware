import type { Request, Response, NextFunction } from "express";

/**
 * Capture the raw request body as a Buffer so we can verify Shopify HMAC.
 * Must be used BEFORE express.json() on webhook routes.
 */
export function captureRawBody(req: Request, _res: Response, next: NextFunction): void {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });
  req.on("end", () => {
    (req as Request & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
    next();
  });
  req.on("error", next);
}
