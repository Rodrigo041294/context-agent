/**
 * Service to handle OAuth2 Authentication with AWS Cognito using client_credentials grant type.
 */

export interface CognitoTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  [key: string]: any;
}

export function encodeBase64(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa(str);
  }
}

export async function fetchOAuthToken(): Promise<string> {
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

  return token;
}
