import { queryOptions } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import type { PlatformProvider, PlatformProviderProtocol } from '@librechat/data-schemas';
import { z } from 'zod';
import { apiFetch, extractApiError } from './utils/api';

export type AdminProvider = Omit<PlatformProvider, 'encryptedCredential' | 'credentialFingerprint'>;

const providerId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/);
const providerVersion = z.number().int().positive();
const modelId = z.string().trim().min(1).max(256);
const protocol = z.enum([
  'anthropic',
  'anthropic-compatible',
  'openai-compatible',
  'bedrock',
  'vertex',
  'foundry',
] satisfies [PlatformProviderProtocol, ...PlatformProviderProtocol[]]);

async function parseProviderResponse(response: Response, fallback: string): Promise<AdminProvider> {
  if (!response.ok) await extractApiError(response, fallback);
  const body = (await response.json()) as { provider: AdminProvider };
  return body.provider;
}

export const getProvidersFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ providers: AdminProvider[] }> => {
    const response = await apiFetch('/api/admin/providers');
    if (!response.ok) await extractApiError(response, 'Failed to load providers');
    const body = (await response.json()) as { providers: AdminProvider[] };
    return { providers: body.providers };
  },
);

export const providersQueryOptions = queryOptions({
  queryKey: ['adminProviders'],
  queryFn: () => getProvidersFn(),
  staleTime: 15_000,
});

export const createProviderFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      providerId,
      protocol,
      name: z.string().trim().min(1).max(120),
      baseUrl: z.string().trim().url().max(2_048),
      credential: z.string().min(1).max(16_384),
    }),
  )
  .handler(async ({ data }) => {
    const response = await apiFetch('/api/admin/providers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { provider: await parseProviderResponse(response, 'Failed to create provider') };
  });

type VersionedProviderInput = { providerId: string; expectedCatalogVersion: number };
type ProviderRequestBody = {
  modelIds?: string[];
  defaultModel?: string;
  fallbackModel?: string;
};

async function versionedProviderRequest(
  data: VersionedProviderInput,
  path: string,
  method: 'POST' | 'PUT',
  body?: ProviderRequestBody,
): Promise<{ provider: AdminProvider }> {
  const response = await apiFetch(
    `/api/admin/providers/${encodeURIComponent(data.providerId)}${path}`,
    {
      method,
      body: JSON.stringify({ expectedCatalogVersion: data.expectedCatalogVersion, ...body }),
    },
  );
  return { provider: await parseProviderResponse(response, 'Provider operation failed') };
}

export const rotateProviderCredentialFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      providerId,
      expectedCatalogVersion: providerVersion,
      credential: z.string().min(1).max(16_384),
    }),
  )
  .handler(async ({ data }) => {
    const response = await apiFetch(
      `/api/admin/providers/${encodeURIComponent(data.providerId)}/credential`,
      {
        method: 'PUT',
        body: JSON.stringify({
          expectedCatalogVersion: data.expectedCatalogVersion,
          credential: data.credential,
        }),
      },
    );
    return {
      provider: await parseProviderResponse(response, 'Failed to rotate provider credential'),
    };
  });

export const checkProviderFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ providerId, expectedCatalogVersion: providerVersion }))
  .handler(({ data }) => versionedProviderRequest(data, '/check', 'POST'));

export const discoverProviderModelsFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ providerId, expectedCatalogVersion: providerVersion }))
  .handler(({ data }) => versionedProviderRequest(data, '/discover', 'POST'));

export const checkProviderModelFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ providerId, expectedCatalogVersion: providerVersion, modelId }))
  .handler(({ data }) =>
    versionedProviderRequest(data, `/models/${encodeURIComponent(data.modelId)}/check`, 'POST'),
  );

export const publishProviderModelsFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      providerId,
      expectedCatalogVersion: providerVersion,
      modelIds: z.array(modelId).min(1).max(500),
      defaultModel: modelId.optional(),
      fallbackModel: modelId.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { providerId: id, expectedCatalogVersion, ...body } = data;
    return versionedProviderRequest(
      { providerId: id, expectedCatalogVersion },
      '/publication',
      'PUT',
      body,
    );
  });

export const enableProviderFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ providerId, expectedCatalogVersion: providerVersion }))
  .handler(({ data }) => versionedProviderRequest(data, '/enable', 'POST'));

export const disableProviderFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ providerId, expectedCatalogVersion: providerVersion }))
  .handler(({ data }) => versionedProviderRequest(data, '/disable', 'POST'));
