/**
 * IDT-01/02 + VLT-02 — API client contract: only hashes, codes, display
 * names and opaque vault blobs cross the wire; errors surface as ApiError;
 * the bearer token is attached once a session exists.
 */
import { ApiError, getVault, pushVault, requestOtp, verifyOtp } from '../api/client';
import { saveTokens } from '../lib/session';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

function jsonResponse(status: number, body: unknown): unknown {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('IDT-01 requestOtp', () => {
  it('posts the phone hash and returns the dev code when present (OQ-IDT-1)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { devCode: '123456' }));
    const result = await requestOtp({ phoneHash: 'abc123' });
    expect(result).toEqual({ devCode: '123456' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/otp/request');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ phoneHash: 'abc123' });
  });

  it('returns an empty result when the API omits the dev code (production)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await expect(requestOtp({ phoneHash: 'abc123' })).resolves.toEqual({});
  });

  it('throws ApiError with the HTTP status on failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse(429, {}));
    await expect(requestOtp({ phoneHash: 'abc123' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 429,
    });
  });
});

describe('IDT-02 verifyOtp and session header', () => {
  it('returns the token pair on success', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { accessToken: 'a1', refreshToken: 'r1' }),
    );
    await expect(verifyOtp({ phoneHash: 'abc', code: '123456' })).resolves.toEqual({
      accessToken: 'a1',
      refreshToken: 'r1',
    });
  });

  it('surfaces 422 (new user without displayName) as ApiError', async () => {
    fetchMock.mockResolvedValue(jsonResponse(422, {}));
    await expect(
      verifyOtp({ phoneHash: 'abc', code: '123456' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('sends no authorization header before login, and a bearer token after', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await requestOtp({ phoneHash: 'abc' });
    const [, before] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((before.headers as Record<string, string>).authorization).toBeUndefined();

    await saveTokens({ accessToken: 'tok-1', refreshToken: 'ref-1' });
    await requestOtp({ phoneHash: 'abc' });
    const [, after] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((after.headers as Record<string, string>).authorization).toBe('Bearer tok-1');
  });
});

describe('VLT-02 vault endpoints — opaque blob only', () => {
  it('pushVault returns the new version on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { version: 7 }));
    await expect(pushVault({ blob: 'b64', version: 6 })).resolves.toEqual({
      ok: true,
      version: 7,
    });
  });

  it('pushVault maps 409 to a typed conflict, not an exception (VLT-04)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, {}));
    await expect(pushVault({ blob: 'b64', version: 6 })).resolves.toEqual({
      ok: false,
      reason: 'conflict',
    });
  });

  it('pushVault throws ApiError on other failures', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));
    await expect(pushVault({ blob: 'b64', version: 6 })).rejects.toMatchObject({
      status: 500,
    });
  });

  it('getVault returns the blob, null on 404, and throws otherwise', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { blob: 'b64', version: 3 }));
    await expect(getVault()).resolves.toEqual({ blob: 'b64', version: 3 });

    fetchMock.mockResolvedValueOnce(jsonResponse(404, {}));
    await expect(getVault()).resolves.toBeNull();

    fetchMock.mockResolvedValueOnce(jsonResponse(503, {}));
    await expect(getVault()).rejects.toBeInstanceOf(ApiError);
  });
});
