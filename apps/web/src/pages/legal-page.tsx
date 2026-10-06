import type { ReactNode } from "react";

interface LegalPageProps {
  readonly children: ReactNode;
  readonly title: string;
}

/**
 * Render a legal information page using the main site's layout.
 * @returns The legal page element.
 */
export const LegalPage = ({ children, title }: LegalPageProps) => (
  <main className="min-h-dvh bg-canvas px-4 pb-10 text-ink sm:px-5">
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 py-4 sm:py-5">
      <a className="font-bold tracking-tight" href="/">
        Hamilton <span className="font-normal text-copy-muted">Bin Day</span>
      </a>
      <a
        className="rounded-lg px-3 py-2 text-sm font-semibold text-sage-dark underline-offset-4 hover:underline"
        href="/"
      >
        Back to home
      </a>
    </header>
    <article className="mx-auto w-full max-w-3xl pt-8 sm:pt-12">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
        {title}
      </h1>
      <div className="mt-8 space-y-6 text-sm leading-7 text-body-muted sm:text-base">
        {children}
      </div>
    </article>
  </main>
);
