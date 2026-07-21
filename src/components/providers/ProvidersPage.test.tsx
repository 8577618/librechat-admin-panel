import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  createMutate: vi.fn(),
  useMutation: vi.fn(),
}));

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
  useMutation: mocks.useMutation,
}));

import { ProvidersPage } from './ProvidersPage';

describe('ProvidersPage', () => {
  beforeEach(() => {
    let mutationIndex = 0;
    mocks.createMutate.mockReset();
    mocks.useMutation.mockImplementation(() => ({
      mutate: mutationIndex++ === 0 ? mocks.createMutate : vi.fn(),
      isPending: false,
    }));
  });

  it('renders the provider registry empty state and create entry point', () => {
    render(<ProvidersPage />);

    expect(screen.getByRole('region', { name: 'com_nav_providers' })).toBeInTheDocument();
    expect(screen.getByText('com_providers_empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'com_providers_add' })).toBeInTheDocument();
  });

  it('normalizes a provider ID before creation', () => {
    render(<ProvidersPage />);
    fireEvent.click(screen.getByRole('button', { name: 'com_providers_add' }));

    const providerId = screen.getByRole('textbox', { name: 'com_providers_id' });
    fireEvent.change(providerId, { target: { value: ' My Gateway_01 ' } });
    fireEvent.blur(providerId);

    expect(providerId).toHaveValue('my-gateway-01');
  });

  it('blocks creation when the provider ID cannot be normalized', () => {
    render(<ProvidersPage />);
    fireEvent.click(screen.getByRole('button', { name: 'com_providers_add' }));

    const providerId = screen.getByRole('textbox', { name: 'com_providers_id' });
    fireEvent.change(providerId, { target: { value: '网关' } });
    fireEvent.submit(providerId.closest('form')!);

    expect(mocks.createMutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('com_providers_id_invalid');
  });
});
