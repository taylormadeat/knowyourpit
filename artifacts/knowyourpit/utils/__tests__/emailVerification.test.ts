import { requiresEmailVerification } from "../emailVerification";

describe("requiresEmailVerification", () => {
  it("recognizes the unverified field Clerk returns on an email sign-up", () => {
    expect(
      requiresEmailVerification({
        unverifiedFields: ["email_address"],
      }),
    ).toBe(true);
  });

  it("recognizes the verification status returned by transferred sign-ups", () => {
    expect(
      requiresEmailVerification({
        verifications: { emailAddress: { status: "unverified" } },
      }),
    ).toBe(true);
  });

  it("does not treat an accepted Apple identity as needing an email code", () => {
    expect(
      requiresEmailVerification({
        unverifiedFields: [],
        verifications: { emailAddress: { status: "verified" } },
      }),
    ).toBe(false);
  });
});