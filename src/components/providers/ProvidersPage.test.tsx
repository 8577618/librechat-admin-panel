import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminProvider } from '@/server';
import { notifySuccess } from '@/utils';
import translation from '@/locales/en/translation.json';
import translationZhCN from '@/locales/zh-CN/translation.json';
import type { ProviderPublicationPayload } from './ProvidersPage';
import { buildPublicationPayload, isSamePublication, ProvidersPage } from './ProvidersPage';

const mocks = vi.hoisted(() => ({
  createMutate: vi.fn(),
  localize: vi.fn((key: string) => key),
  notifySuccess: vi.fn(),
  publicationPending: false,
  providersQueryFn: vi.fn(),
  publishMutate: vi.fn(),
  publishProviderModelsFn: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock('@/hooks', () => ({
  useCapabilities: () => ({ hasCapability: () => true }),
  useLocalize: () => mocks.localize,
}));

vi.mock('@/utils', () => ({
  notifySuccess: mocks.notifySuccess,
}));

vi.mock('@/server', () => ({
  providersQueryOptions: {
    queryKey: ['adminProviders'],
    queryFn: mocks.providersQueryFn,
    staleTime: 15_000,
  },
  createProviderFn: vi.fn(),
  checkProviderFn: vi.fn(),
  discoverProviderModelsFn: vi.fn(),
  checkProviderModelFn: vi.fn(),
  publishProviderModelsFn: mocks.publishProviderModelsFn,
  enableProviderFn: vi.fn(),
  disableProviderFn: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useMutation: mocks.useMutation };
});

type PublicationVariables = {
  provider: AdminProvider;
  payload: ProviderPublicationPayload;
};

type PublicationMutationOptions = {
  mutationFn: (variables: PublicationVariables) => Promise<{ provider: AdminProvider }>;
  onSuccess: (data: { provider: AdminProvider }, variables: PublicationVariables) => void;
  onError: (error: Error, variables: PublicationVariables) => Promise<void>;
};

let publicationMutation: PublicationMutationOptions;

function makeProvider(overrides: Partial<AdminProvider> = {}): AdminProvider {
  return {
    providerId: 'gateway',
    protocol: 'openai-compatible',
    name: 'Gateway',
    baseUrl: 'https://gateway.example.test/v1',
    enabled: false,
    status: 'healthy',
    credentialDisplay: '************tail',
    credentialRotatedAt: new Date('2026-07-21T00:00:00.000Z'),
    discoveredModels: [
      { id: 'alpha', source: 'discovered', checkStatus: 'compatible' },
      { id: 'beta', source: 'discovered', checkStatus: 'compatible' },
    ],
    publishedModels: [{ id: 'alpha', label: 'Alpha', enabled: true }],
    defaultModel: 'alpha',
    fallbackModel: 'alpha',
    catalogVersion: 3,
    claudeCompatibility: 'untested',
    lastCheckStatus: 'passed',
    createdBy: 'admin-1',
    updatedBy: 'admin-1',
    ...overrides,
  };
}

function renderPage(providers: AdminProvider[] = []): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(['adminProviders'], { providers });
  render(
    <QueryClientProvider client={queryClient}>
      <ProvidersPage />
    </QueryClientProvider>,
  );
  return queryClient;
}

function selectPublication(modelIds: string[]): void {
  for (const modelId of modelIds) {
    fireEvent.click(screen.getByRole('checkbox', { name: `com_providers_publish ${modelId}` }));
  }
}

describe('provider publication helpers', () => {
  it('trims, removes empty and duplicate model IDs, sorts them, and retains selected defaults', () => {
    const provider = makeProvider({ defaultModel: 'beta', fallbackModel: 'alpha' });

    expect(buildPublicationPayload(provider, [' beta ', '', 'alpha', 'beta', '  '])).toEqual({
      modelIds: ['alpha', 'beta'],
      defaultModel: 'beta',
      fallbackModel: 'alpha',
    });
  });

  it('falls back deterministically when the existing default or fallback is not selected', () => {
    expect(
      buildPublicationPayload(makeProvider({ defaultModel: 'missing', fallbackModel: 'beta' }), [
        'beta',
        'alpha',
      ]),
    ).toEqual({ modelIds: ['alpha', 'beta'], defaultModel: 'alpha', fallbackModel: 'beta' });
    expect(
      buildPublicationPayload(makeProvider({ defaultModel: 'beta', fallbackModel: 'missing' }), [
        'beta',
        'alpha',
      ]),
    ).toEqual({ modelIds: ['alpha', 'beta'], defaultModel: 'beta', fallbackModel: 'beta' });
  });

  it('compares publications without depending on model order', () => {
    const provider = makeProvider({
      publishedModels: [
        { id: 'beta', label: 'Beta', enabled: true },
        { id: 'alpha', label: 'Alpha', enabled: true },
      ],
      defaultModel: 'beta',
      fallbackModel: 'alpha',
    });

    expect(
      isSamePublication(provider, {
        modelIds: ['beta', 'alpha'],
        defaultModel: 'beta',
        fallbackModel: 'alpha',
      }),
    ).toBe(true);
  });

  it('does not treat the same models with a different default as the same publication', () => {
    expect(
      isSamePublication(makeProvider(), {
        modelIds: ['alpha'],
        defaultModel: 'beta',
        fallbackModel: 'alpha',
      }),
    ).toBe(false);
  });
});

describe('ProvidersPage', () => {
  beforeEach(() => {
    let mutationIndex = 0;
    mocks.createMutate.mockReset();
    mocks.localize.mockClear();
    mocks.notifySuccess.mockReset();
    mocks.publicationPending = false;
    mocks.providersQueryFn.mockReset();
    mocks.publishMutate.mockReset();
    mocks.publishProviderModelsFn.mockReset();
    mocks.useMutation.mockReset();
    mocks.useMutation.mockImplementation((options: object) => {
      const index = mutationIndex++ % 4;
      if (index === 3) {
        publicationMutation = options as PublicationMutationOptions;
        return { mutate: mocks.publishMutate, isPending: mocks.publicationPending };
      }
      return { mutate: index === 0 ? mocks.createMutate : vi.fn(), isPending: false };
    });
  });

  it('renders the provider registry empty state and create entry point', () => {
    renderPage();

    expect(screen.getByRole('region', { name: 'com_nav_providers' })).toBeInTheDocument();
    expect(screen.getByText('com_providers_empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'com_providers_add' })).toBeInTheDocument();
  });

  it('normalizes a provider ID before creation', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'com_providers_add' }));

    const providerId = screen.getByRole('textbox', { name: 'com_providers_id' });
    fireEvent.change(providerId, { target: { value: ' My Gateway_01 ' } });
    fireEvent.blur(providerId);

    expect(providerId).toHaveValue('my-gateway-01');
  });

  it('blocks creation when the provider ID cannot be normalized', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'com_providers_add' }));

    const providerId = screen.getByRole('textbox', { name: 'com_providers_id' });
    fireEvent.change(providerId, { target: { value: '网关' } });
    fireEvent.submit(providerId.closest('form')!);

    expect(mocks.createMutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('com_providers_id_invalid');
  });

  it('shows published models and disables an identical canonical publication', () => {
    renderPage([makeProvider()]);

    expect(screen.getByText('com_providers_published')).toBeInTheDocument();
    const publishButton = screen.getByRole('button', { name: 'com_providers_publish_selected' });
    expect(publishButton).toBeDisabled();

    selectPublication(['alpha']);

    expect(publishButton).toBeDisabled();
  });

  it('disables compatible model selection while publication is pending', () => {
    mocks.publicationPending = true;

    renderPage([makeProvider()]);

    expect(screen.getByRole('checkbox', { name: 'com_providers_publish alpha' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'com_providers_publish beta' })).toBeDisabled();
  });

  it('publishes a changed canonical selection and applies the returned provider immediately', async () => {
    const provider = makeProvider();
    const updated = makeProvider({
      catalogVersion: 4,
      publishedModels: [
        { id: 'alpha', label: 'Alpha', enabled: true },
        { id: 'beta', label: 'Beta', enabled: true },
      ],
    });
    const queryClient = renderPage([provider]);
    const setQueryData = vi.spyOn(queryClient, 'setQueryData');
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    selectPublication(['beta', 'alpha']);

    fireEvent.click(screen.getByRole('button', { name: 'com_providers_publish_selected' }));

    const variables = {
      provider,
      payload: {
        modelIds: ['alpha', 'beta'],
        defaultModel: 'alpha',
        fallbackModel: 'alpha',
      },
    };
    expect(mocks.publishMutate).toHaveBeenCalledWith(variables);
    mocks.publishProviderModelsFn.mockResolvedValue({ provider: updated });
    await expect(publicationMutation.mutationFn(variables)).resolves.toEqual({ provider: updated });
    expect(mocks.publishProviderModelsFn).toHaveBeenCalledWith({
      data: {
        providerId: 'gateway',
        expectedCatalogVersion: 3,
        modelIds: ['alpha', 'beta'],
        defaultModel: 'alpha',
        fallbackModel: 'alpha',
      },
    });

    act(() => publicationMutation.onSuccess({ provider: updated }, variables));

    expect(queryClient.getQueryData(['adminProviders'])).toEqual({ providers: [updated] });
    expect(setQueryData).toHaveBeenCalledWith(['adminProviders'], expect.any(Function));
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['adminProviders'] });
    expect(mocks.localize).toHaveBeenCalledWith('com_providers_publish_success', { count: 2 });
    expect(notifySuccess).toHaveBeenCalledWith('com_providers_publish_success');
    expect(screen.getByRole('checkbox', { name: 'com_providers_publish alpha' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'com_providers_publish beta' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'com_providers_publish_selected' })).toBeDisabled();
  });

  it('treats an error as success when the refreshed provider already has the attempted publication', async () => {
    const provider = makeProvider();
    const updated = makeProvider({
      catalogVersion: 4,
      publishedModels: [
        { id: 'alpha', label: 'Alpha', enabled: true },
        { id: 'beta', label: 'Beta', enabled: true },
      ],
    });
    const queryClient = renderPage([provider]);
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(async () => {
      queryClient.setQueryData(['adminProviders'], { providers: [updated] });
    });
    selectPublication(['alpha', 'beta']);
    fireEvent.click(screen.getByRole('button', { name: 'com_providers_publish_selected' }));
    const variables = mocks.publishMutate.mock.calls[0][0] as PublicationVariables;

    await act(async () => {
      await publicationMutation.onError(new Error('Request timed out'), variables);
    });

    expect(notifySuccess).toHaveBeenCalledWith('com_providers_publish_success');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'com_providers_publish alpha' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'com_providers_publish beta' })).not.toBeChecked();
  });

  it('keeps the selection and shows a sanitized error when publication did not commit', async () => {
    const provider = makeProvider();
    const queryClient = renderPage([provider]);
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(async () => {
      queryClient.setQueryData(['adminProviders'], { providers: [provider] });
    });
    selectPublication(['alpha', 'beta']);
    fireEvent.click(screen.getByRole('button', { name: 'com_providers_publish_selected' }));
    const variables = mocks.publishMutate.mock.calls[0][0] as PublicationVariables;

    await act(async () => {
      await publicationMutation.onError(new Error('Publication failed'), variables);
    });

    expect(notifySuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Publication failed');
    expect(screen.getByRole('checkbox', { name: 'com_providers_publish alpha' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'com_providers_publish beta' })).toBeChecked();
  });

  it('defines the required English and Simplified Chinese publication labels', () => {
    expect(translation.com_providers_published).toBe('Published');
    expect(translation.com_providers_publish_success).toBe('Published {{count}} models');
    expect(translationZhCN.com_providers_published).toBe('已发布');
    expect(translationZhCN.com_providers_publish_success).toBe('已发布 {{count}} 个模型');
  });
});
