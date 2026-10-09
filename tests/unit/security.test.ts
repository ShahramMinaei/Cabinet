import { describe, it, expect } from "vitest";
import { validPushEndpoint } from "@/server/push";
describe("push endpoint security", () => {
  it("accepts browser push providers", () => {
    expect(validPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(
      true,
    );
    expect(
      validPushEndpoint(
        "https://updates.push.services.mozilla.com/wpush/v2/abc",
      ),
    ).toBe(true);
  });
  it("rejects local, credentialed and attacker-controlled endpoints", () => {
    for (const url of [
      "https://127.0.0.1/",
      "https://localhost/",
      "https://fcm.googleapis.com.evil.com/",
      "http://fcm.googleapis.com/",
      "https://user:secret@fcm.googleapis.com/",
      "https://fcm.googleapis.com:8443/",
    ])
      expect(validPushEndpoint(url)).toBe(false);
  });
});
