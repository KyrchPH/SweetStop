import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, storedValue) {
  const parts = storedValue.split(":");

  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const [, salt, storedHash] = parts;
  const incomingHash = scryptSync(password, salt, 64).toString("hex");

  return timingSafeEqual(Buffer.from(storedHash, "hex"), Buffer.from(incomingHash, "hex"));
}
