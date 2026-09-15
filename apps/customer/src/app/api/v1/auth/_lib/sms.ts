import type { Logger } from "@avenick/observability";

/**
 * THE SMS SEAM — and the reason it is empty.
 *
 * No SMS provider is wired to this platform. The OTP flow is still built,
 * because the storage, the hashing rule and the rate limits are the parts that
 * are expensive to retrofit and easy to get wrong; sending is a fifteen-line
 * adapter. What must NOT happen in the meantime is an endpoint that answers 200
 * with a challenge id when nothing was sent, because that reads to a client, a
 * QA engineer and a demo audience as a working flow — and the first person to
 * discover otherwise is the one waiting for a code that will never arrive.
 *
 * So this interface has a `configured` flag, the only implementation returns
 * false for it, and `POST /v1/auth/otp/request` answers 503
 * `upstream_unavailable` — a status the published contract already lists for
 * that endpoint — rather than pretending. Wiring a real provider is: implement
 * `SmsSender`, call `setSmsSender()` at bootstrap, done.
 */

export interface SmsMessage {
  /** E.164, as `PhoneSchema` requires. */
  to: string;
  body: string;
}

export interface SmsSender {
  /** Named in logs so a deployment can be told which adapter answered. */
  readonly name: string;
  /**
   * Whether this sender can actually deliver. False is not an error state — it
   * is the honest answer for a platform with no provider — but callers must
   * refuse rather than proceed.
   */
  readonly configured: boolean;
  send(message: SmsMessage): Promise<void>;
}

/**
 * Delivers nothing and says so.
 *
 * It still logs, at WARN, with the recipient but WITHOUT the message body: the
 * body contains the one-time code, and a code in a log line is a credential in
 * a log aggregator that half the company can read.
 */
export function createNoopSmsSender(log: Logger): SmsSender {
  return {
    name: "noop",
    configured: false,
    async send(message) {
      log.warn("sms not sent: no provider is configured for this deployment", {
        to: message.to,
        bytes: message.body.length,
      });
    },
  };
}

let override: SmsSender | null = null;

/**
 * Install a real provider at bootstrap, or a fake in a test. Deliberately a
 * setter rather than an env-var lookup inside the route: the route should not
 * know which vendor is in use, and a test should not have to set env vars to
 * exercise the happy path.
 */
export function setSmsSender(sender: SmsSender | null): void {
  override = sender;
}

export function resolveSmsSender(log: Logger): SmsSender {
  return override ?? createNoopSmsSender(log);
}

/**
 * Whether an undeliverable code may nonetheless be minted, with the code
 * written to the log so a developer can complete the flow locally.
 *
 * Two independent conditions, both required, because either one alone is a
 * foot-gun: an explicit opt-in variable, AND a non-production NODE_ENV. A
 * production deployment cannot reach this branch even if the variable is set by
 * accident, which is the failure mode that matters — one-time codes in a
 * production log are one-time codes anybody with log access can spend.
 */
export function devEchoEnabled(): boolean {
  return process.env.OTP_DEV_ECHO === "1" && process.env.NODE_ENV !== "production";
}
