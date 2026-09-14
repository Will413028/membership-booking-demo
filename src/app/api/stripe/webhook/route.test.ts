import { beforeEach, describe, expect, it, vi } from "vitest";

const { constructEvent, getStripeClient, processStripeEvent } = vi.hoisted(
  () => ({
    constructEvent: vi.fn(),
    getStripeClient: vi.fn(),
    processStripeEvent: vi.fn(),
  }),
);

vi.mock("@/lib/stripe/events", () => ({ processStripeEvent }));
vi.mock("@/lib/stripe/server", () => ({ getStripeClient }));

import { POST } from "./route";

describe("POST /api/stripe/webhook", () => {
  it("passes only the verified event and keeps processing errors safe/retryable", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    const event = { id: "evt_verified", livemode: false };
    constructEvent.mockReturnValue(event);
    processStripeEvent
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("private detail"));
    const request = () =>
      new Request("https://motion-room.test/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "signed" },
        body: "raw test body",
      });
    expect((await POST(request())).status).toBe(200);
    expect(constructEvent).toHaveBeenCalledWith(
      "raw test body",
      "signed",
      "whsec_test",
    );
    expect(processStripeEvent).toHaveBeenCalledWith(event);
    const failed = await POST(request());
    expect(failed.status).toBe(500);
    expect(await failed.text()).toBe("Unable to process Stripe event.");
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    getStripeClient.mockReturnValue({
      webhooks: { constructEvent },
    });
  });

  it("returns 500 when the webhook secret is missing", async () => {
    const response = await POST(
      new Request("https://motion-room.test/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(500);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it("returns 500 when the Stripe client is not configured", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    getStripeClient.mockImplementation(() => {
      throw new Error("Stripe is not configured.");
    });

    const response = await POST(
      new Request("https://motion-room.test/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(500);
  });

  it("returns 400 only when the signature is missing or invalid", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    constructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const missingSignature = await POST(
      new Request("https://motion-room.test/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      }),
    );
    const invalidSignature = await POST(
      new Request("https://motion-room.test/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "bad" },
        body: "{}",
      }),
    );

    expect(missingSignature.status).toBe(400);
    expect(invalidSignature.status).toBe(400);
    expect(processStripeEvent).not.toHaveBeenCalled();
  });
});
