"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircleIcon, CloseCircleIcon, DangerTriangleIcon, InfoCircleIcon, LoaderIcon } from "@solar-icons/react/line-duotone";

const Toaster = ({ theme = "dark", ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={theme}
      position="top-center"
      className="toaster group"
      mobileOffset={{ top: "var(--inset-top)" }}
      icons={{
        success: (
          <CheckCircleIcon className="size-icon text-success" />
        ),
        info: (
          <InfoCircleIcon className="size-icon text-info" />
        ),
        warning: (
          <DangerTriangleIcon className="size-icon text-warning" />
        ),
        error: (
          <CloseCircleIcon className="size-icon text-destructive" />
        ),
        loading: (
          <LoaderIcon className="size-icon text-primary-text motion-safe:animate-spin" />
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
