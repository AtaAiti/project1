import assert from "node:assert/strict";
import { test, afterEach } from "vitest";
import { isAdminUser } from "../src/lib/admin-identity.ts";

const originalUserId = process.env.ADMIN_USER_ID;
const originalEmail = process.env.ADMIN_EMAIL;

afterEach(() => {
  if (originalUserId === undefined) delete process.env.ADMIN_USER_ID;
  else process.env.ADMIN_USER_ID = originalUserId;
  if (originalEmail === undefined) delete process.env.ADMIN_EMAIL;
  else process.env.ADMIN_EMAIL = originalEmail;
});

test("ADMIN_USER_ID is the primary admin check", () => {
  process.env.ADMIN_USER_ID = "primary-user";
  process.env.ADMIN_EMAIL = "secondary@example.com";
  assert.equal(isAdminUser({ id: "primary-user", email: "other@example.com" }), true);
  assert.equal(isAdminUser({ id: "other-user", email: "secondary@example.com" }), false);
});

test("ADMIN_EMAIL is a case-insensitive fallback", () => {
  delete process.env.ADMIN_USER_ID;
  process.env.ADMIN_EMAIL = "Admin@Example.com";
  assert.equal(isAdminUser({ id: "any-user", email: "admin@example.com" }), true);
  assert.equal(isAdminUser({ id: "any-user", email: "other@example.com" }), false);
});

test("admin access fails closed without identity configuration", () => {
  delete process.env.ADMIN_USER_ID;
  delete process.env.ADMIN_EMAIL;
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(isAdminUser({ id: "any-user", email: "admin@example.com" }), false);
  } finally {
    console.error = originalError;
  }
});
