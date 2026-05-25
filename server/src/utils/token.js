import { createHmac, timingSafeEqual } from "node:crypto";

function encodeBase64Url(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64Url(input) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (base64.length % 4)) % 4;
  return Buffer.from(base64 + "=".repeat(padding), "base64");
}

function signPart(value, secret) {
  return createHmac("sha256", secret).update(value).digest();
}

export function signToken(payload, secret, expiresInSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const safeTtl = Number.isFinite(expiresInSeconds) ? Math.max(60, Math.floor(expiresInSeconds)) : 28800;

  const header = {
    alg: "HS256",
    typ: "JWT"
  };

  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + safeTtl
  };

  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(fullPayload));
  const toSign = `${encodedHeader}.${encodedPayload}`;
  const signature = encodeBase64Url(signPart(toSign, secret));

  return `${toSign}.${signature}`;
}

export function verifyToken(token, secret) {
  if (typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const toSign = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = signPart(toSign, secret);
  const providedSignature = decodeBase64Url(encodedSignature);

  if (providedSignature.length !== expectedSignature.length) {
    return null;
  }

  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return null;
  }

  let payload;

  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8"));
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  if (typeof payload.exp !== "number" || now >= payload.exp) {
    return null;
  }

  return payload;
}
