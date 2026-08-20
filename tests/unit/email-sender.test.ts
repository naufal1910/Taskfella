import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  EMAIL_DISPATCH_WINDOW_MS,
  LocalEmailSender,
  SmtpEmailSender,
  createApplicationLink,
  dispatchEmailWithinWindow,
} from "@/server/modules/auth/email-sender";

const environment = {
  NODE_ENV: "test" as const,
  DATABASE_URL: "postgresql://taskfella:taskfella@localhost:5432/taskfella",
  APP_URL: "http://localhost:3000",
  LOG_LEVEL: "info" as const,
  DB_POOL_MAX: 10,
};

const smtpEnvironment = {
  ...environment,
  EMAIL_DELIVERY_MODE: "smtp" as const,
  EMAIL_SMTP_HOST: "smtp.example.test",
  EMAIL_SMTP_PORT: 587,
  EMAIL_SMTP_SECURE: false,
  EMAIL_FROM: "Taskfella <no-reply@example.test>",
};

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("transactional email boundary", () => {
  it("holds absent and slow dispatches to the same bounded response window", async () => {
    vi.useFakeTimers();
    try {
      const skipped = dispatchEmailWithinWindow();
      const slow = dispatchEmailWithinWindow(() => new Promise<void>(() => undefined));

      await vi.advanceTimersByTimeAsync(EMAIL_DISPATCH_WINDOW_MS);

      await expect(skipped).resolves.toBe("skipped");
      await expect(slow).resolves.toBe("timed-out");
    } finally {
      vi.useRealTimers();
    }
  });

  it("contains dispatch failures within the generic response window", async () => {
    vi.useFakeTimers();
    try {
      const failed = dispatchEmailWithinWindow(async () => {
        throw new Error("delivery failure");
      });

      await vi.advanceTimersByTimeAsync(EMAIL_DISPATCH_WINDOW_MS);

      await expect(failed).resolves.toBe("failed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("requires STARTTLS when SMTP is not using implicit TLS", () => {
    const sender = new SmtpEmailSender(smtpEnvironment);
    const transport = (
      sender as unknown as {
        transporter: {
          options: {
            requireTLS?: boolean;
            dnsTimeout?: number;
            connectionTimeout?: number;
            greetingTimeout?: number;
            socketTimeout?: number;
          };
        };
      }
    ).transporter;

    expect(transport.options.requireTLS).toBe(true);
    expect(transport.options.dnsTimeout).toBe(5_000);
    expect(transport.options.connectionTimeout).toBe(5_000);
    expect(transport.options.greetingTimeout).toBe(5_000);
    expect(transport.options.socketTimeout).toBe(10_000);
  });

  it("closes the SMTP transport after a delivery attempt", async () => {
    const sender = new SmtpEmailSender(smtpEnvironment);
    const transport = (
      sender as unknown as {
        transporter: {
          sendMail: (input: unknown) => Promise<unknown>;
          close: () => void;
        };
      }
    ).transporter;
    const sendMail = vi.spyOn(transport, "sendMail").mockRejectedValue(new Error("smtp failure"));
    const close = vi.spyOn(transport, "close");

    await expect(
      sender.sendVerificationEmail({
        to: "person@example.test",
        link: createApplicationLink("/verify-email", crypto.randomUUID(), smtpEnvironment),
        expiresAt: new Date("2026-08-13T00:00:00.000Z"),
      }),
    ).rejects.toThrow("smtp failure");

    expect(sendMail).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("captures minimal verification and reset evidence locally without provider credentials", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "taskfella-mail-"));
    temporaryDirectories.push(directory);
    const sender = new LocalEmailSender({ directory }, environment);
    const verificationLink = createApplicationLink(
      "/verify-email",
      crypto.randomUUID(),
      environment,
    );
    const resetLink = createApplicationLink("/reset-password", crypto.randomUUID(), environment);
    const expiresAt = new Date("2026-08-11T00:00:00.000Z");

    await sender.sendVerificationEmail({
      to: "person@example.test",
      link: verificationLink,
      expiresAt,
    });
    await sender.sendPasswordResetEmail({ to: "person@example.test", link: resetLink, expiresAt });

    const files = await readdir(directory);
    expect(files).toHaveLength(2);
    expect(files.every((file) => !file.includes("person@example.test"))).toBe(true);
    const messages = await Promise.all(
      files.map(async (file) => JSON.parse(await readFile(path.join(directory, file), "utf8"))),
    );
    expect(messages.map((message) => message.kind).sort()).toEqual([
      "password-reset",
      "verification",
    ]);
    expect(messages[0]).toMatchObject({
      to: "person@example.test",
      capturedAt: expect.any(String),
    });
    expect(messages[0].text).toContain("expires");
    expect(messages[0].html).toContain("<main>");
    expect(messages.some((message) => message.link === verificationLink)).toBe(true);
    expect(messages.some((message) => message.link === resetLink)).toBe(true);
  });
});
