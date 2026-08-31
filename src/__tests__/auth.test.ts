import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchOAuthToken, encodeBase64 } from "../services/auth";

describe("Cognito OAuth2 Service", () => {
  const mockFetch = vi.fn();
  globalThis.fetch = mockFetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_AUTH_URL", "https://us-east-1qut4lhkwo.auth.us-east-1.amazoncognito.com/oauth2/token");
    vi.stubEnv("VITE_AUTH_USER", "test-client-id");
    vi.stubEnv("VITE_AUTH_PASSWORD", "test-client-secret");
  });

  it("should encode base64 correctly", () => {
    const encoded = encodeBase64("user:pass");
    expect(encoded).toBe(btoa("user:pass"));
  });

  it("should successfully fetch token with correct headers, method, and body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "mock-access-token-xyz",
        token_type: "Bearer",
        expires_in: 3600,
      }),
    });

    const token = await fetchOAuthToken();
    expect(token).toBe("mock-access-token-xyz");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://us-east-1qut4lhkwo.auth.us-east-1.amazoncognito.com/oauth2/token");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(options.headers["Authorization"]).toBe(`Basic ${btoa("test-client-id:test-client-secret")}`);
    expect(options.body).toBe("grant_type=client_credentials");
  });

  it("should support fallback environment variable names (VITE_USER / VITE_PASSWORD)", async () => {
    vi.stubEnv("VITE_AUTH_USER", "");
    vi.stubEnv("VITE_AUTH_PASSWORD", "");
    vi.stubEnv("VITE_USER", "fallback-user");
    vi.stubEnv("VITE_PASSWORD", "fallback-pass");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "fallback-token",
      }),
    });

    const token = await fetchOAuthToken();
    expect(token).toBe("fallback-token");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Authorization"]).toBe(`Basic ${btoa("fallback-user:fallback-pass")}`);
  });

  it("should throw a descriptive error when Cognito returns an error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: "invalid_client",
        error_description: "Client authentication failed",
      }),
    });

    await expect(fetchOAuthToken()).rejects.toThrow(
      "Fallo en autenticación Cognito: Client authentication failed"
    );
  });

  it("should throw an error when Cognito response has no access_token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await expect(fetchOAuthToken()).rejects.toThrow(
      "Respuesta de autenticación inválida: no se recibió access_token."
    );
  });
});
