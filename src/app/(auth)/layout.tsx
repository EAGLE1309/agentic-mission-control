import Link from "next/link";
import { Mark } from "@/components/mark";
import { AuthShowcase } from "@/features/auth/auth-showcase";

// Auth pages (FR-2): the form on the left, and on wide screens a grey panel
// with the landing headline on the right (design §6.12). Always dark, like the
// landing (theme-provider.tsx); the class also covers the first paint of a client navigation.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark grid min-h-dvh flex-1 bg-background text-foreground lg:grid-cols-2">
      <div className="flex min-w-0 flex-col px-4 py-3 sm:px-8">
        <header className="flex h-14 items-center">
          <Link
            href="/"
            className="flex h-9 items-center gap-2 rounded-md pr-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Mark className="text-foreground" />
            <span className="text-sm font-semibold">Mission Control</span>
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center py-10">{children}</main>
        <footer className="flex h-10 items-center text-xs text-muted-foreground">
          <span>
            Built by{" "}
            <a
              href="https://eagledev.in"
              target="_blank"
              rel="noopener"
              className="font-medium text-foreground underline decoration-border decoration-from-font underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-foreground"
            >
              eagledev.in
            </a>
          </span>
        </footer>
      </div>
      <AuthShowcase />
    </div>
  );
}
