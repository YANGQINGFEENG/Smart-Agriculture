"use client"

import { FarmProvider } from "@/lib/farm-context"
import { CustomThemeProvider } from "@/components/custom-theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CustomThemeProvider defaultTheme="dark">
      <FarmProvider>
        {children}
      </FarmProvider>
    </CustomThemeProvider>
  )
}
