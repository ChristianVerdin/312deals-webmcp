"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { useState, type ReactNode } from "react"
import { Toaster } from "sonner"
import { WebMCPProvider } from "./webmcp-provider"
import { TonightPanel } from "./tonight-panel"

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        {children}
        <WebMCPProvider />
        <TonightPanel />
        <Toaster position="bottom-center" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
