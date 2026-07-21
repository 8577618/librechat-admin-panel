import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlatformProviderDiscoveredModel } from '@librechat/data-schemas';
import { useCapabilities, useLocalize } from '@/hooks';
import { SystemCapabilities } from '@/constants';
import {
  checkProviderFn,
  checkProviderModelFn,
  createProviderFn,
  discoverProviderModelsFn,
  disableProviderFn,
  enableProviderFn,
  publishProviderModelsFn,
  providersQueryOptions,
  type AdminProvider,
} from '@/server';

type ProviderAction = 'check' | 'discover' | 'enable' | 'disable';
type ProviderActionInput = { provider: AdminProvider; action: ProviderAction };

const protocols = [
  'anthropic-compatible',
  'anthropic',
  'openai-compatible',
  'bedrock',
  'vertex',
  'foundry',
] as const;

function statusKey(status: AdminProvider['status']): string {
  return `com_providers_status_${status}`;
}

function modelStatusKey(status: PlatformProviderDiscoveredModel['checkStatus']): string {
  return `com_providers_model_status_${status}`;
}

function isCompatible(model: PlatformProviderDiscoveredModel): boolean {
  return model.checkStatus === 'compatible';
}

export function normalizeProviderId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}

export function ProvidersPage() {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { hasCapability } = useCapabilities();
  const canManage = hasCapability(SystemCapabilities.MANAGE_PROVIDERS);
  const { data, isLoading, isError } = useQuery(providersQueryOptions);
  const providers = data?.providers ?? [];
  const [showCreate, setShowCreate] = useState(false);
  const [selectedModels, setSelectedModels] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    providerId: '',
    protocol: 'anthropic-compatible' as (typeof protocols)[number],
    name: '',
    baseUrl: '',
    credential: '',
  });

  const refreshProviders = () => {
    void queryClient.invalidateQueries({ queryKey: ['adminProviders'] });
  };

  const createMutation = useMutation({
    mutationFn: (input: typeof form) => createProviderFn({ data: input }),
    onSuccess: () => {
      setForm({
        providerId: '',
        protocol: 'anthropic-compatible',
        name: '',
        baseUrl: '',
        credential: '',
      });
      setShowCreate(false);
      setError(null);
      refreshProviders();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const actionMutation = useMutation({
    mutationFn: ({ provider, action }: ProviderActionInput) => {
      const data = {
        providerId: provider.providerId,
        expectedCatalogVersion: provider.catalogVersion,
      };
      if (action === 'check') return checkProviderFn({ data });
      if (action === 'discover') return discoverProviderModelsFn({ data });
      if (action === 'enable') return enableProviderFn({ data });
      return disableProviderFn({ data });
    },
    onSuccess: () => {
      setError(null);
      refreshProviders();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const modelCheckMutation = useMutation({
    mutationFn: (input: { provider: AdminProvider; modelId: string }) =>
      checkProviderModelFn({
        data: {
          providerId: input.provider.providerId,
          expectedCatalogVersion: input.provider.catalogVersion,
          modelId: input.modelId,
        },
      }),
    onSuccess: () => {
      setError(null);
      refreshProviders();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const publishMutation = useMutation({
    mutationFn: ({ provider, modelIds }: { provider: AdminProvider; modelIds: string[] }) =>
      publishProviderModelsFn({
        data: {
          providerId: provider.providerId,
          expectedCatalogVersion: provider.catalogVersion,
          modelIds,
          defaultModel: modelIds[0],
          fallbackModel: modelIds[0],
        },
      }),
    onSuccess: () => {
      setError(null);
      refreshProviders();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const toggleModel = (providerId: string, modelId: string) => {
    setSelectedModels((current) => {
      const selected = new Set(current[providerId] ?? []);
      if (selected.has(modelId)) selected.delete(modelId);
      else selected.add(modelId);
      return { ...current, [providerId]: [...selected] };
    });
  };

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const normalizedProviderId = normalizeProviderId(form.providerId);
    if (!normalizedProviderId) {
      setError(localize('com_providers_id_invalid'));
      return;
    }
    createMutation.mutate({ ...form, providerId: normalizedProviderId });
  };

  return (
    <div
      role="region"
      aria-label={localize('com_nav_providers')}
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-(--cui-color-text-default)">
            {localize('com_providers_title')}
          </h2>
          <p className="mt-1 text-sm text-(--cui-color-text-muted)">
            {localize('com_providers_subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          disabled={!canManage}
          className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-panel) px-3 py-2 text-sm font-medium text-(--cui-color-text-default) hover:bg-(--cui-color-background-hover) disabled:cursor-not-allowed disabled:opacity-50"
        >
          {localize(showCreate ? 'com_ui_cancel' : 'com_providers_add')}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-300 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={submitCreate}
          className="grid gap-3 rounded-lg border border-(--cui-color-stroke-default) bg-(--cui-color-background-panel) p-4 md:grid-cols-2"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span>{localize('com_providers_id')}</span>
            <input
              required
              maxLength={63}
              placeholder="my-gateway"
              value={form.providerId}
              onChange={(event) => setForm({ ...form, providerId: event.target.value })}
              onBlur={() =>
                setForm((current) => ({
                  ...current,
                  providerId: normalizeProviderId(current.providerId),
                }))
              }
              className="rounded-md border border-(--cui-color-stroke-default) bg-transparent px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{localize('com_providers_protocol')}</span>
            <select
              value={form.protocol}
              onChange={(event) =>
                setForm({ ...form, protocol: event.target.value as (typeof protocols)[number] })
              }
              className="rounded-md border border-(--cui-color-stroke-default) bg-transparent px-3 py-2"
            >
              {protocols.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{localize('com_providers_name')}</span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="rounded-md border border-(--cui-color-stroke-default) bg-transparent px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{localize('com_providers_base_url')}</span>
            <input
              required
              type="url"
              placeholder="https://gateway.example.com"
              value={form.baseUrl}
              onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
              className="rounded-md border border-(--cui-color-stroke-default) bg-transparent px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span>{localize('com_providers_credential')}</span>
            <input
              required
              type="password"
              autoComplete="new-password"
              value={form.credential}
              onChange={(event) => setForm({ ...form, credential: event.target.value })}
              className="rounded-md border border-(--cui-color-stroke-default) bg-transparent px-3 py-2"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-(--cui-color-background-active) px-3 py-2 text-sm font-medium text-(--cui-color-text-default) disabled:opacity-50"
            >
              {localize('com_providers_create')}
            </button>
          </div>
        </form>
      )}

      {isLoading && (
        <div className="text-sm text-(--cui-color-text-muted)">{localize('com_ui_loading')}</div>
      )}
      {isError && <div role="alert">{localize('com_providers_load_error')}</div>}
      {!isLoading && !isError && providers.length === 0 && (
        <div className="rounded-lg border border-dashed border-(--cui-color-stroke-default) p-8 text-center text-sm text-(--cui-color-text-muted)">
          {localize('com_providers_empty')}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {providers.map((provider) => {
          const selected = selectedModels[provider.providerId] ?? [];
          return (
            <article
              key={provider.providerId}
              className="rounded-lg border border-(--cui-color-stroke-default) bg-(--cui-color-background-panel) p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-(--cui-color-text-default)">{provider.name}</h3>
                  <p className="text-xs text-(--cui-color-text-muted)">
                    {provider.providerId} / {provider.protocol}
                  </p>
                </div>
                <span className="text-xs text-(--cui-color-text-muted)">
                  {localize(statusKey(provider.status))}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                <div>
                  <dt className="text-xs text-(--cui-color-text-muted)">
                    {localize('com_providers_base_url')}
                  </dt>
                  <dd className="truncate">{provider.baseUrl}</dd>
                </div>
                <div>
                  <dt className="text-xs text-(--cui-color-text-muted)">
                    {localize('com_providers_credential')}
                  </dt>
                  <dd>{provider.credentialDisplay}</dd>
                </div>
                <div>
                  <dt className="text-xs text-(--cui-color-text-muted)">
                    {localize('com_providers_catalog_version')}
                  </dt>
                  <dd>{provider.catalogVersion}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {(['check', 'discover'] as const).map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={!canManage || actionMutation.isPending}
                    onClick={() => actionMutation.mutate({ provider, action })}
                    className="rounded-md border border-(--cui-color-stroke-default) px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {localize(`com_providers_${action}`)}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={!canManage || actionMutation.isPending || provider.status !== 'healthy'}
                  onClick={() =>
                    actionMutation.mutate({
                      provider,
                      action: provider.enabled ? 'disable' : 'enable',
                    })
                  }
                  className="rounded-md border border-(--cui-color-stroke-default) px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  {localize(provider.enabled ? 'com_providers_disable' : 'com_providers_enable')}
                </button>
              </div>

              {provider.discoveredModels.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-150 text-left text-sm">
                    <thead className="text-xs text-(--cui-color-text-muted)">
                      <tr>
                        <th className="px-2 py-2">{localize('com_providers_model')}</th>
                        <th className="px-2 py-2">{localize('com_providers_model_status')}</th>
                        <th className="px-2 py-2">{localize('com_providers_model_action')}</th>
                        <th className="px-2 py-2">{localize('com_providers_publish')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provider.discoveredModels.map((model) => (
                        <tr key={model.id} className="border-t border-(--cui-color-stroke-default)">
                          <td className="px-2 py-2 font-mono text-xs">{model.id}</td>
                          <td className="px-2 py-2 text-xs">
                            {localize(modelStatusKey(model.checkStatus))}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              disabled={!canManage || modelCheckMutation.isPending}
                              onClick={() =>
                                modelCheckMutation.mutate({ provider, modelId: model.id })
                              }
                              className="rounded-md border border-(--cui-color-stroke-default) px-2 py-1 text-xs disabled:opacity-50"
                            >
                              {localize('com_providers_check_model')}
                            </button>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              aria-label={`${localize('com_providers_publish')} ${model.id}`}
                              disabled={!canManage || !isCompatible(model)}
                              checked={selected.includes(model.id)}
                              onChange={() => toggleModel(provider.providerId, model.id)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    type="button"
                    disabled={!canManage || selected.length === 0 || publishMutation.isPending}
                    onClick={() => publishMutation.mutate({ provider, modelIds: selected })}
                    className="mt-3 rounded-md bg-(--cui-color-background-active) px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  >
                    {localize('com_providers_publish_selected', { count: selected.length })}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
