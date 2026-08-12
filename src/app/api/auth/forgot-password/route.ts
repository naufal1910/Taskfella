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
import { parseEmail as normalizeInputEmail } from "@/server/modules/auth/input";
import { getAccountByNormalizedEmail } from "@/server/modules/auth/accounts";
import {
  createApplicationLink,
  createEmailSender,
  dispatchEmailWithinWindow,
} from "@/server/modules/auth/email-sender";
import { issuePasswordResetToken } from "@/server/modules/auth/lifecycle";
import { logger } from "@/server/observability/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RESET_MESSAGE =
  "If an account matches that address, we sent reset instructions. Check your inbox to continue.";

export async function POST(request: Request): Promise<NextResponse> {
  return authRoute(request, async (context) => {
    requireAuthCsrf(request, context);
    const body = await parseJsonObject(request);
    const email = normalizeInputEmail(body.email);
    const db = databaseFor(context);
    await enforceAuthRateLimits(request, db, "passwordReset", email);

    await dispatchEmailWithinWindow(async () => {
      try {
        const account = await getAccountByNormalizedEmail(db, email);
        const issued = account ? await issuePasswordResetToken(db, account.id) : null;
        if (!issued) {
          return;
        }

        const environment = context.environment ?? getEnvironment();
        const sender = createEmailSender(environment);
        await sender.sendPasswordResetEmail({
          to: issued.account.email,
          link: createApplicationLink("/reset-password", issued.reset.token, environment),
          expiresAt: issued.reset.expiresAt,
        });
      } catch {
        logger.error("password_reset_message_dispatch_failed", {
          requestId: context.requestId,
          correlationId: context.correlationId,
          status: 503,
          errorCode: "EMAIL_DELIVERY_FAILED",
          component: "authentication",
        });
      }
    });

    return noStoreResponse({ ok: true, status: "pending", message: RESET_MESSAGE }, 202, context);
  });
}
