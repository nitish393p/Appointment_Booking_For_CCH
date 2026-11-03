import { describe, expect, it } from "vitest";
import { signInErrorMessage } from "../src/pages/Login.jsx";

describe("sign-in error messages", () => {
  it("explains how to resolve unrecognized credentials without exposing server details", () => {
    const message = signInErrorMessage({
      code: "invalid_credentials",
      message: "Invalid login credentials",
    });

    expect(message).toContain("Authentication → Users");
    expect(message).toContain("reset this user's password");
    expect(message).not.toContain("Invalid login credentials");
  });

  it("asks the user to confirm an unconfirmed email", () => {
    expect(signInErrorMessage({ code: "email_not_confirmed" }))
      .toContain("Confirm it in Supabase Authentication");
  });

  it("handles authentication rate limits", () => {
    expect(signInErrorMessage({ status: 429 }))
      .toContain("wait a few minutes");
  });

  it("does not display arbitrary authentication errors", () => {
    const message = signInErrorMessage({ message: "sensitive server detail" });
    expect(message).toContain("Supabase project configuration");
    expect(message).not.toContain("sensitive server detail");
  });
});
