"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      mobileOffset={{ bottom: "var(--toast-offset)" }}
      icons={{
        success: (
          <CircleCheckIcon className="size-icon-sm" />
        ),
        info: (
          <InfoIcon className="size-icon-sm" />
        ),
        warning: (
          <TriangleAlertIcon className="size-icon-sm" />
        ),
        error: (
          <OctagonXIcon className="size-icon-sm" />
        ),
        loading: (
          <Loader2Icon className="size-icon-sm animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
