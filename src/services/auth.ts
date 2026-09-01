/**
 * Service to handle OAuth2 Authentication with AWS Cognito using client_credentials grant type.
 */

export interface CognitoTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  [key: string]: any;
}

interface CachedToken {
  value: string;
  /** Epoch ms after which the token must be considered expired. */
  expiresAt: number;
}

/** Refresh the token this many ms before it actually expires to avoid edge races. */
const TOKEN_EXPIRY_SKEW_MS = 60_000;
/** Fallback lifetime (seconds) when Cognito does not return expires_in. */
const DEFAULT_TOKEN_TTL_SECONDS = 3600;

let cachedToken: CachedToken | null = null;
let inflightToken: Promise<string> | null = null;

export function encodeBase64(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa(str);
  }
}

/**
 * Low-level call to the Cognito token endpoint. Always performs a network request
 * and returns the raw token response (no caching).
 */
export async function requestOAuthToken(): Promise<CognitoTokenResponse> {
  const authUrl =
    (import.meta.env.VITE_AUTH_URL ||
      import.meta.env.VITE_COGNITO_AUTH_URL ||
      "https://us-east-1qut4lhkwo.auth.us-east-1.amazoncognito.com/oauth2/token").trim();

  const user = (
    import.meta.env.VITE_AUTH_USER ||
    import.meta.env.VITE_USER ||
    import.meta.env.VITE_COGNITO_USER ||
    import.meta.env.VITE_COGNITO_CLIENT_ID ||
    ""
  ).trim();

  const password = (
    import.meta.env.VITE_AUTH_PASSWORD ||
    import.meta.env.VITE_PASSWORD ||
    import.meta.env.VITE_COGNITO_PASSWORD ||
    import.meta.env.VITE_COGNITO_CLIENT_SECRET ||
    ""
  ).trim();

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (user && password) {
    headers["Authorization"] = `Basic ${encodeBase64(`${user}:${password}`)}`;
  }

  const body = new URLSearchParams();
  body.append("grant_type", "client_credentials");

  const response = await fetch(authUrl, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  if (!response.ok) {
    let errorMessage = `Error HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData) {
        errorMessage =
          errorData.error_description ||
          errorData.error ||
          errorData.message ||
          JSON.stringify(errorData);
      }
    } catch {
      // Fallback if response is not JSON
    }
    throw new Error(`Fallo en autenticación Cognito: ${errorMessage}`);
  }

  const data: CognitoTokenResponse = await response.json();

  const token = data.access_token || data.id_token || data.token;
  if (!token) {
    throw new Error("Respuesta de autenticación inválida: no se recibió access_token.");
  }

  return data;
}

/**
 * Fetches a fresh OAuth token and returns just the access token string.
 * Kept for backwards compatibility; prefer {@link getAccessToken} which reuses
 * the token while it is still valid.
 */
export async function fetchOAuthToken(): Promise<string> {
  const data = await requestOAuthToken();
  return data.access_token || data.id_token || data.token;
}

/**
 * Returns a valid access token, reusing the cached one while it is still vigente
 * and only hitting Cognito again when it is missing or about to expire.
 * Concurrent callers share a single in-flight request.
 */
export async function getAccessToken(forceRefresh = false): Promise<string> {
  const now = Date.now();

  if (!forceRefresh && cachedToken && cachedToken.expiresAt - TOKEN_EXPIRY_SKEW_MS > now) {
    return cachedToken.value;
  }

  if (inflightToken) {
    return inflightToken;
  }

  inflightToken = (async () => {
    const data = await requestOAuthToken();
    const token = data.access_token || data.id_token || data.token;
    const ttlSeconds =
      typeof data.expires_in === "number" && data.expires_in > 0
        ? data.expires_in
        : DEFAULT_TOKEN_TTL_SECONDS;
    cachedToken = { value: token, expiresAt: Date.now() + ttlSeconds * 1000 };
    return token;
  })();

  try {
    return await inflightToken;
  } finally {
    inflightToken = null;
  }
}

/** Clears the in-memory token cache. Mainly useful for tests and forced re-auth. */
export function clearTokenCache(): void {
  cachedToken = null;
  inflightToken = null;
}
