import { randomInt } from "node:crypto";

// No 0/O, 1/l/I: a temporary password is read out or typed from a message.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** A random temporary password for an account an admin creates or resets (the person must change it at first sign-in). */
export function generateTempPassword(length = 10): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}
