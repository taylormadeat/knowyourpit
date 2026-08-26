import {
  APPLE_ACCOUNT_LABEL,
  getAccountDisplayIdentity,
  isAppleAccount,
  type AccountIdentityUser,
} from "../accountIdentity";

const emailUser = (emailAddress: string): AccountIdentityUser => ({
  emailAddresses: [{ emailAddress }],
});

describe("Apple account identity", () => {
  it("recognizes native Apple sign-up metadata", () => {
    const user = {
      ...emailUser("person@example.com"),
      unsafeMetadata: { signInProvider: "apple" },
    };

    expect(isAppleAccount(user)).toBe(true);
    expect(getAccountDisplayIdentity(user)).toBe(APPLE_ACCOUNT_LABEL);
  });

  it("recognizes an Apple external account for older users", () => {
    const user = {
      ...emailUser("person@example.com"),
      externalAccounts: [{ provider: "oauth_apple" }],
    };

    expect(isAppleAccount(user)).toBe(true);
    expect(getAccountDisplayIdentity(user)).toBe(APPLE_ACCOUNT_LABEL);
  });

  it("hides a private relay address even when account metadata is unavailable", () => {
    const user = emailUser("n7fzz66rq5@privaterelay.appleid.com");

    expect(isAppleAccount(user)).toBe(true);
    expect(getAccountDisplayIdentity(user)).toBe(APPLE_ACCOUNT_LABEL);
  });

  it("keeps an ordinary email address visible", () => {
    const user = emailUser("pitmaster@example.com");

    expect(isAppleAccount(user)).toBe(false);
    expect(getAccountDisplayIdentity(user)).toBe("pitmaster@example.com");
  });
});