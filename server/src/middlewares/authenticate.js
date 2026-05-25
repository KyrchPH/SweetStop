import { getAuthConfig } from "../config/auth.js";
import { getAccountAuthContext } from "../services/auth.service.js";
import { HttpError } from "../utils/http-error.js";
import { verifyToken } from "../utils/token.js";

function getBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== "string") {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token.trim();
}

export async function authenticate(req, _res, next) {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      throw new HttpError(401, "Missing bearer token.");
    }

    const { jwtSecret } = getAuthConfig();
    const payload = verifyToken(token, jwtSecret);

    if (!payload || typeof payload.sub !== "string" || payload.token_type !== "access") {
      throw new HttpError(401, "Invalid or expired token.");
    }

    const context = await getAccountAuthContext(payload.sub);

    if (!context) {
      throw new HttpError(401, "Account not found.");
    }

    if (context.status !== "ACTIVE") {
      throw new HttpError(403, "Account is not active.");
    }

    req.auth = {
      ...context,
      token_payload: payload
    };

    next();
  } catch (error) {
    next(error);
  }
}
