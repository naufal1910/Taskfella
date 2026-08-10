import { getEnvironment } from "@/server/config/env";

/**
 * Validate required configuration before the application begins serving requests.
 * Database reachability remains a runtime readiness concern exposed by /api/health.
 */
export function register(): void {
  getEnvironment();
}
