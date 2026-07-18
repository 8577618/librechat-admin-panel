import { createFileRoute } from '@tanstack/react-router';
import { ProvidersPage } from '@/components/providers';
import { AccessDenied, PermissionsUnavailable } from '@/components/shared';
import { SystemCapabilities } from '@/constants';
import { useCapabilities } from '@/hooks';

export const Route = createFileRoute('/_app/providers')({
  component: ProvidersRoute,
});

function ProvidersRoute() {
  const { hasCapability, isLoading, isError } = useCapabilities();

  if (isLoading) return null;
  if (isError) return <PermissionsUnavailable />;
  if (!hasCapability(SystemCapabilities.READ_PROVIDERS)) return <AccessDenied />;
  return <ProvidersPage />;
}
