export type HealthStatus = "ok" | "degraded";
export type DatabaseStatus = "ready" | "unavailable";

export interface HealthResponse {
  status: HealthStatus;
  application: "ok";
  database: DatabaseStatus;
  requestId: string;
  correlationId: string;
  httpStatus: 200 | 503;
}

export type DatabaseReadinessCheck = () => Promise<boolean>;

export async function evaluateHealth(
  requestId: string,
  correlationId: string,
  checkDatabase: DatabaseReadinessCheck,
): Promise<HealthResponse> {
  let databaseReady = false;

  try {
    databaseReady = await checkDatabase();
  } catch {
    databaseReady = false;
  }

  return {
    status: databaseReady ? "ok" : "degraded",
    application: "ok",
    database: databaseReady ? "ready" : "unavailable",
    requestId,
    correlationId,
    httpStatus: databaseReady ? 200 : 503,
  };
}
