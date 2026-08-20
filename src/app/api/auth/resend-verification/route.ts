import { NextResponse } from "next/server";
import { getEnvironment } from "@/server/config/env";
import {
  authRoute,
  databaseFor,
  enforceAuthRateLimits,
  noStoreResponse,
  parseJsonObject,
  requireAuthCsrf,
} from "@/server/http/auth-route";
import { parseEmail } from "@/server/modules/auth/input";
import { getAccountByNormalizedEmail } from "@/server/modules/auth/accounts";
import {
  createApplicationLink,
  createEmailSender,
  dispatchEmailWithinWindow,
} from "@/server/modules/auth/email-sender";
import { issueVerificationToken } from "@/server/modules/auth/lifecycle";
import { logger } from "@/server/observability/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VERIFICATION_MESSAGE =
  "If that address needs verification, we sent a fresh link. Check your inbox to continue.";

export async function POST(request: Request): Promise<NextResponse> {
  return authRoute(request, async (context) => {
    requireAuthCsrf(request, context);
    const email = parseEmail((await parseJsonObject(request)).email);
    const db = databaseFor(context);
    await enforceAuthRateLimits(request, db, "emailVerification", email);

    const account = await getAccountByNormalizedEmail(db, email);
    const issued =
      account && !account.emailVerifiedAt ? await issueVerificationToken(db, account.id) : null;

    await dispatchEmailWithinWindow(
      issued
        ? async () => {
            try {
              const environment = context.environment ?? getEnvironment();
              const sender = createEmailSender(environment);
              await sender.sendVerificationEmail({
                to: issued.account.email,
                link: createApplicationLink(
                  "/verify-email",
                  issued.verification.token,
                  environment,
                ),
                expiresAt: issued.verification.expiresAt,
              });
            } catch {
              logger.error("verification_resend_dispatch_failed", {
                requestId: context.requestId,
                correlationId: context.correlationId,
                status: 503,
                errorCode: "EMAIL_DELIVERY_FAILED",
                component: "authentication",
              });
            }
          }
        : undefined,
    );

    return noStoreResponse(
      { ok: true, status: "pending", message: VERIFICATION_MESSAGE },
      202,
      context,
    );
  });
}
