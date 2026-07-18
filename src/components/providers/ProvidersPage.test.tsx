import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks', () => ({
  useCapabilities: () => ({ hasCapability: () => true }),
  useLocalize: () => (key: string) => key,
}));

vi.mock('@/server', () => ({
  providersQueryOptions: { queryKey: ['adminProviders'], queryFn: vi.fn() },
  createProviderFn: vi.fn(),
  checkProviderFn: vi.fn(),
  discoverProviderModelsFn: vi.fn(),
  checkProviderModelFn: vi.fn(),
  publishProviderModelsFn: vi.fn(),
  enableProviderFn: vi.fn(),
  disableProviderFn: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { providers: [] }, isLoading: false, isError: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ProvidersPage } from './ProvidersPage';

describe('ProvidersPage', () => {
  it('renders the provider registry empty state and create entry point', () => {
    render(<ProvidersPage />);

    expect(screen.getByRole('region', { name: 'com_nav_providers' })).toBeInTheDocument();
    expect(screen.getByText('com_providers_empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'com_providers_add' })).toBeInTheDocument();
  });
});
