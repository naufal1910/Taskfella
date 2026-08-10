import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { type AppEnv, getEnvironment } from "@/server/config/env";

export interface TransactionalEmailInput {
  to: string;
  link: string;
  expiresAt: Date;
}

export interface EmailSender {
  sendVerificationEmail(input: TransactionalEmailInput): Promise<void>;
  sendPasswordResetEmail(input: TransactionalEmailInput): Promise<void>;
}

interface CapturedMessage {
  kind: "verification" | "password-reset";
  to: string;
  from: string;
  link: string;
  subject: string;
  text: string;
  html: string;
  capturedAt: string;
}

function formatExpiry(expiresAt: Date): string {
  return expiresAt.toISOString();
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}

function buildMessage(
  kind: CapturedMessage["kind"],
  input: TransactionalEmailInput,
  from: string,
): CapturedMessage {
  const isVerification = kind === "verification";
  const action = isVerification
    ? "verify your Taskfella email address"
    : "reset your Taskfella password";
  const buttonLabel = isVerification ? "Verify email address" : "Reset password";
  const subject = isVerification
    ? "Verify your Taskfella email address"
    : "Reset your Taskfella password";
  const expiry = formatExpiry(input.expiresAt);
  const safeLink = escapeHtml(input.link);

  return {
    kind,
    to: input.to,
    from,
    link: input.link,
    subject,
    text: `Taskfella\n\nUse this link to ${action}:\n${input.link}\n\nThis one-time link expires at ${expiry}. If you did not request this message, you can ignore it.\n`,
    html: `<!doctype html><html lang="en"><body><main><h1>Taskfella</h1><p>Use the link below to ${escapeHtml(action)}.</p><p><a href="${safeLink}">${buttonLabel}</a></p><p>This one-time link expires at <time datetime="${escapeHtml(expiry)}">${escapeHtml(expiry)}</time>.</p><p>If you did not request this message, you can ignore it.</p></main></body></html>`,
    capturedAt: new Date().toISOString(),
  };
}

export function createApplicationLink(
  pathname: "/verify-email" | "/reset-password",
  token: string,
  environment: AppEnv = getEnvironment(),
): string {
  const link = new URL(pathname, environment.APP_URL);
  link.searchParams.set("token", token);
  return link.toString();
}

export class LocalEmailSender implements EmailSender {
  private readonly directory: string;
  private readonly from: string;

  constructor(
    options: { directory?: string; from?: string } = {},
    environment: AppEnv = getEnvironment(),
  ) {
    this.directory = options.directory ?? environment.EMAIL_LOCAL_CAPTURE_DIR ?? ".local/mail";
    this.from = options.from ?? environment.EMAIL_FROM ?? "Taskfella <no-reply@localhost>";
  }

  async sendVerificationEmail(input: TransactionalEmailInput): Promise<void> {
    await this.capture(buildMessage("verification", input, this.from));
  }

  async sendPasswordResetEmail(input: TransactionalEmailInput): Promise<void> {
    await this.capture(buildMessage("password-reset", input, this.from));
  }

  private async capture(message: CapturedMessage): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const filename = `${message.capturedAt.replace(/[:.]/g, "-")}-${randomUUID()}.json`;
    const target = path.join(this.directory, filename);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(message, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporary, target);
  }
}

export class SmtpEmailSender implements EmailSender {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(environment: AppEnv = getEnvironment()) {
    if (environment.EMAIL_DELIVERY_MODE !== "smtp" || !environment.EMAIL_SMTP_HOST) {
      throw new Error("SMTP email delivery is not configured.");
    }

    this.from = environment.EMAIL_FROM ?? "";
    if (!this.from) {
      throw new Error("SMTP sender address is not configured.");
    }

    this.transporter = nodemailer.createTransport({
      host: environment.EMAIL_SMTP_HOST,
      port: environment.EMAIL_SMTP_PORT ?? 587,
      secure: environment.EMAIL_SMTP_SECURE ?? false,
      ...(environment.EMAIL_SMTP_USER && environment.EMAIL_SMTP_PASSWORD
        ? {
            auth: {
              user: environment.EMAIL_SMTP_USER,
              pass: environment.EMAIL_SMTP_PASSWORD,
            },
          }
        : {}),
    });
  }

  async sendVerificationEmail(input: TransactionalEmailInput): Promise<void> {
    await this.send(buildMessage("verification", input, this.from));
  }

  async sendPasswordResetEmail(input: TransactionalEmailInput): Promise<void> {
    await this.send(buildMessage("password-reset", input, this.from));
  }

  private async send(message: CapturedMessage): Promise<void> {
    await this.transporter.sendMail({
      from: message.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

export function createEmailSender(environment: AppEnv = getEnvironment()): EmailSender {
  if (environment.NODE_ENV === "production") {
    return new SmtpEmailSender(environment);
  }

  if (environment.EMAIL_DELIVERY_MODE === "smtp") {
    return new SmtpEmailSender(environment);
  }

  return new LocalEmailSender({}, environment);
}
