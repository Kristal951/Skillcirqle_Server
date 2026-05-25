import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

const secret = process.env.MESSAGE_ENCRYPTION_KEY;

if (!secret) {
  throw new Error("Missing MESSAGE_ENCRYPTION_KEY");
}

const KEY = Buffer.from(secret, "hex");

export const encryptMessage = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    KEY,
    iv
  );

  let encrypted = cipher.update(
    text,
    "utf8",
    "hex"
  );

  encrypted += cipher.final("hex");

  return `${iv.toString("hex")}:${encrypted}`;
};

export const decryptMessage = (encryptedText) => {
  const [ivHex, encrypted] = encryptedText.split(":");

  const iv = Buffer.from(ivHex, "hex");

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY,
    iv
  );

  let decrypted = decipher.update(
    encrypted,
    "hex",
    "utf8"
  );

  decrypted += decipher.final("utf8");

  return decrypted;
};