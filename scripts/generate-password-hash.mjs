import { randomBytes, pbkdf2Sync } from "node:crypto";
const password=process.argv[2];
if(!password||password.length<16||password.length>256)throw new Error("Provide a unique password of 16–256 characters.");
const salt=randomBytes(16);
const derived=pbkdf2Sync(password,salt,310000,32,"sha256");
const b64=b=>b.toString("base64url");
console.log("pbkdf2$310000$"+b64(salt)+"$"+b64(derived));
