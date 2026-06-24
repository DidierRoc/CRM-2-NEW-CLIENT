import { Skeleton } from '@/components/ui/skeleton';

export const ClientDashboardSkeleton = () => (
  <div className="max-w-6xl space-y-6 pb-8" aria-hidden="true">
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Skeleton className="h-[268px] rounded-lg" />
      <Skeleton className="h-[268px] rounded-lg" />
    </div>
    <Skeleton className="h-[92px] rounded-lg" />
    <Skeleton className="h-[152px] rounded-lg" />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[132px] rounded-lg" />)}
    </div>
    <Skeleton className="h-[340px] rounded-lg" />
  </div>
);

export const ClientListPageSkeleton = ({ cards = 4 }: { cards?: number }) => (
  <div className="max-w-4xl space-y-6" aria-hidden="true">
    <div className="flex items-center gap-3">
      <Skeleton className="h-12 w-12 rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72 max-w-[70vw]" />
      </div>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: cards }).map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
    </div>
  </div>
);

export const ClientRowsSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="max-w-4xl space-y-6" aria-hidden="true">
    <div className="space-y-2">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80 max-w-[70vw]" />
    </div>
    <div className="rounded-lg border bg-card p-4">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
    </div>
  </div>
);

export const ClientShellSkeleton = () => (
  <div className="min-h-screen bg-background" aria-hidden="true">
    <Skeleton className="h-[112px] rounded-none sm:h-[124px]" />
    <div className="flex">
      <Skeleton className="hidden h-screen w-64 rounded-none lg:block" />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <ClientDashboardSkeleton />
      </main>
    </div>
  </div>
);

const ClientPageFallback = () => <ClientDashboardSkeleton />;

export default ClientPageFallback;
