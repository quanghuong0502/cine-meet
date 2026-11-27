"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi" className="dark h-full">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-group bg-background px-inset text-center text-foreground">
        <div className="flex max-w-form flex-col items-center gap-item rounded-xl border bg-card p-inset-lg">
          <h1 className="type-heading">SeatMate</h1>
          <p className="type-secondary text-muted-foreground">
            Đã có sự cố tạm thời. Vui lòng thử tải lại trang.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-control items-center justify-center rounded-full bg-primary px-inset-lg type-action text-primary-foreground"
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
