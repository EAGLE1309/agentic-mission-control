import { Skeleton } from "@/components/ui/skeleton";

// Route load: a skeleton at once, in the shape of the top bar and a list.
export default function AppLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-1 flex-col">
      <div className="flex h-12 items-center border-b px-4">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-6 md:px-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
