import { randomBytes, pbkdf2Sync } from "node:crypto";
if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
  throw new Error("Run this script directly in an interactive terminal; password input must not be piped or echoed.");
}
process.stderr.write("Enter a unique password (16–256 characters): ");
process.stdin.setRawMode(true);
process.stdin.resume();
let password = "";
const finish = () => {
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stderr.write("\n");
  if (password.length < 16 || password.length > 256) throw new Error("Password must be 16–256 characters.");
  const salt = randomBytes(16);
  const derived = pbkdf2Sync(password, salt, 100000, 32, "sha256");
  password = "";
  process.stdout.write("pbkdf2$100000$" + salt.toString("base64url") + "$" + derived.toString("base64url") + "\n");
};
process.stdin.on("data", (chunk) => {
  for (const byte of chunk) {
    if (byte === 3) { process.stderr.write("\nCancelled.\n"); process.exit(1); }
    if (byte === 13 || byte === 10) { finish(); return; }
    if (byte === 127 || byte === 8) password = password.slice(0, -1);
    else if (byte >= 32 && byte <= 126 && password.length < 256) password += String.fromCharCode(byte);
  }
});
