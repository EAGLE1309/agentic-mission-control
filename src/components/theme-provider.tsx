"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/** The landing and auth pages are always dark (design §6.12). The app follows the user's theme. */
const DARK_ONLY_PATHS = new Set(["/", "/sign-in", "/sign-up"])

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  const pathname = usePathname()
  const forcedTheme = DARK_ONLY_PATHS.has(pathname) ? "dark" : undefined
  return (
    <NextThemesProvider forcedTheme={forcedTheme} {...props}>
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
