import { Skeleton } from "@/components/ui/skeleton";

export const SkeletonLoader = () => {
    return (
        <div className="fixed inset-0 z-[9999] bg-background flex">
            {/* Sidebar Skeleton (hidden on mobile) */}
            <div className="hidden md:flex w-64 border-r p-6 flex-col gap-6">
                <Skeleton className="h-10 w-32" />
                <div className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                </div>
                <div className="mt-auto">
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </div>

            {/* Main Content Skeleton */}
            <div className="flex-1 flex flex-col">
                {/* Header Skeleton */}
                <header className="h-14 border-b flex items-center justify-between px-4 sm:px-6">
                    <div className="container flex items-center justify-between p-0">
                        <Skeleton className="h-7 w-40" />
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <Skeleton className="h-8 w-8 rounded-full" />
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <main className="p-4 sm:p-6 container mx-auto space-y-8 overflow-hidden">
                    {/* Welcome Section */}
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-4 w-full max-w-[400px]" />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-32 w-full rounded-xl" />
                        ))}
                    </div>

                    {/* Charts/Tables Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Skeleton className="lg:col-span-2 h-[400px] w-full rounded-xl" />
                        <Skeleton className="h-[400px] w-full rounded-xl" />
                    </div>
                </main>
            </div>
        </div>
    );
};
