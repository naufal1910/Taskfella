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
import { isUniqueConstraintViolation } from "@/server/modules/auth/accounts";
import { createAccountWithPasswordAndVerification } from "@/server/modules/auth/lifecycle";
import { parseEmailPassword } from "@/server/modules/auth/input";
import { createApplicationLink, createEmailSender } from "@/server/modules/auth/email-sender";
import { logger } from "@/server/observability/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIGNUP_MESSAGE =
  "If this address can be registered, we sent a verification link. Check your inbox to continue.";

export async function POST(request: Request): Promise<NextResponse> {
  return authRoute(request, async (context) => {
    requireAuthCsrf(request, context);
    const input = parseEmailPassword(await parseJsonObject(request));
    const db = databaseFor(context);

    await enforceAuthRateLimits(request, db, "signup", input.email);

    let created;
    try {
      created = await createAccountWithPasswordAndVerification(db, input);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        return noStoreResponse(
          { ok: true, status: "pending", message: SIGNUP_MESSAGE },
          202,
          context,
        );
      }
      throw error;
    }

    try {
      const environment = context.environment ?? getEnvironment();
      const sender = createEmailSender(environment);
      await sender.sendVerificationEmail({
        to: created.account.email,
        link: createApplicationLink("/verify-email", created.verification.token, environment),
        expiresAt: created.verification.expiresAt,
      });
    } catch {
      logger.error("verification_message_dispatch_failed", {
        requestId: context.requestId,
        correlationId: context.correlationId,
        status: 503,
        errorCode: "EMAIL_DELIVERY_FAILED",
        component: "authentication",
      });
      // Keep signup non-enumerating. The user can retry through the resend flow.
    }

    return noStoreResponse({ ok: true, status: "pending", message: SIGNUP_MESSAGE }, 202, context);
  });
}
