export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-sidebar px-4 py-10">
      {children}
    </main>
  );
}
