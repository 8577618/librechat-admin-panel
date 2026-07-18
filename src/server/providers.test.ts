import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock('./utils/api', () => ({
  apiFetch: apiFetchMock,
  extractApiError: vi.fn(async (_response: Response, fallback: string) => {
    throw new Error(fallback);
  }),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (fn: (...args: never[]) => unknown) => fn,
    inputValidator: () => ({
      handler: (fn: (...args: never[]) => unknown) => fn,
    }),
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  queryOptions: (options: unknown) => options,
}));

import {
  createProviderFn,
  discoverProviderModelsFn,
  getProvidersFn,
  publishProviderModelsFn,
} from './providers';

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('provider admin server functions', () => {
  beforeEach(() => apiFetchMock.mockReset());

  it('lists providers through the authenticated admin endpoint', async () => {
    const providers = [{ providerId: 'gateway', name: 'Gateway', catalogVersion: 1 }];
    apiFetchMock.mockResolvedValueOnce(response({ providers }));

    await expect(getProvidersFn()).resolves.toEqual({ providers });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/providers');
  });

  it('creates a provider without exposing or accepting credential display fields', async () => {
    const provider = { providerId: 'gateway', name: 'Gateway', catalogVersion: 1 };
    apiFetchMock.mockResolvedValueOnce(response({ provider }, true, 201));

    await expect(
      createProviderFn({
        data: {
          providerId: 'gateway',
          protocol: 'anthropic-compatible',
          name: 'Gateway',
          baseUrl: 'https://gateway.example.com',
          credential: 'secret',
        },
      }),
    ).resolves.toEqual({ provider });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/providers', {
      method: 'POST',
      body: JSON.stringify({
        providerId: 'gateway',
        protocol: 'anthropic-compatible',
        name: 'Gateway',
        baseUrl: 'https://gateway.example.com',
        credential: 'secret',
      }),
    });
  });

  it('discovers models with the provider catalog version', async () => {
    const provider = { providerId: 'gateway', catalogVersion: 2, discoveredModels: [] };
    apiFetchMock.mockResolvedValueOnce(response({ provider }));

    await expect(
      discoverProviderModelsFn({ data: { providerId: 'gateway', expectedCatalogVersion: 2 } }),
    ).resolves.toEqual({ provider });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/providers/gateway/discover', {
      method: 'POST',
      body: JSON.stringify({ expectedCatalogVersion: 2 }),
    });
  });

  it('publishes only the selected model ids and optional defaults', async () => {
    const provider = { providerId: 'gateway', catalogVersion: 3, publishedModels: [] };
    apiFetchMock.mockResolvedValueOnce(response({ provider }));

    await expect(
      publishProviderModelsFn({
        data: {
          providerId: 'gateway',
          expectedCatalogVersion: 2,
          modelIds: ['claude-3-7-sonnet'],
          defaultModel: 'claude-3-7-sonnet',
          fallbackModel: 'claude-3-7-sonnet',
        },
      }),
    ).resolves.toEqual({ provider });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/providers/gateway/publication', {
      method: 'PUT',
      body: JSON.stringify({
        expectedCatalogVersion: 2,
        modelIds: ['claude-3-7-sonnet'],
        defaultModel: 'claude-3-7-sonnet',
        fallbackModel: 'claude-3-7-sonnet',
      }),
    });
  });
});
