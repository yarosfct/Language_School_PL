'use client';

import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {description ? (
          <p className="mt-2 text-base sm:text-lg text-gray-600 dark:text-gray-300">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className,
  accent = 'neutral',
}: {
  children: ReactNode;
  className?: string;
  accent?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const accentClass =
    accent === 'primary'
      ? 'border-primary-200 dark:border-primary-800/60'
      : accent === 'success'
      ? 'border-accent-100 dark:border-emerald-800/60'
      : accent === 'warning'
      ? 'border-warning-100 dark:border-amber-800/60'
      : accent === 'danger'
      ? 'border-destructive-100 dark:border-red-800/60'
      : accent === 'info'
      ? 'border-info-100 dark:border-blue-800/60'
      : 'border-gray-200 dark:border-gray-700';

  return (
    <div
      className={joinClasses(
        'rounded-card border bg-white/95 p-6 shadow-sm dark:bg-gray-800/95',
        accentClass,
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  icon,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={joinClasses('mb-4', className)}>
      <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
        {icon}
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{description}</p> : null}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ComponentPropsWithoutRef<'button'> & { variant?: ButtonVariant; size?: ButtonSize }) {
  const variantClass =
    variant === 'secondary'
      ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
      : variant === 'ghost'
      ? 'border border-transparent bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
      : variant === 'danger'
      ? 'border border-destructive-500 bg-destructive-500 text-white hover:bg-destructive-600'
      : variant === 'accent'
      ? 'border border-accent-500 bg-accent-500 text-white hover:bg-accent-600'
      : 'border border-primary-500 bg-primary-500 text-white hover:bg-primary-600';

  const sizeClass =
    size === 'sm'
      ? 'px-3 py-1.5 text-sm'
      : size === 'lg'
      ? 'px-5 py-3 text-base'
      : 'px-4 py-2 text-sm';

  return (
    <button
      className={joinClasses(
        'inline-flex items-center justify-center gap-2 rounded-button font-semibold transition-colors duration-default ease-subtle cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900',
        variantClass,
        sizeClass,
        className
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  className,
  variant = 'primary',
  size = 'md',
  children,
}: {
  href: string;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}) {
  const variantClass =
    variant === 'secondary'
      ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
      : variant === 'ghost'
      ? 'border border-transparent bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
      : variant === 'danger'
      ? 'border border-destructive-500 bg-destructive-500 text-white hover:bg-destructive-600'
      : variant === 'accent'
      ? 'border border-accent-500 bg-accent-500 text-white hover:bg-accent-600'
      : 'border border-primary-500 bg-primary-500 text-white hover:bg-primary-600';
  const sizeClass =
    size === 'sm'
      ? 'px-3 py-1.5 text-sm'
      : size === 'lg'
      ? 'px-5 py-3 text-base'
      : 'px-4 py-2 text-sm';

  return (
    <Link
      href={href}
      className={joinClasses(
        'inline-flex items-center justify-center gap-2 rounded-button font-semibold transition-colors duration-default ease-subtle cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900',
        variantClass,
        sizeClass,
        className
      )}
    >
      {children}
    </Link>
  );
}

export function Input({ className, ...props }: ComponentPropsWithoutRef<'input'>) {
  return (
    <input
      className={joinClasses(
        'w-full rounded-button border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900',
        'placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900',
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentPropsWithoutRef<'select'>) {
  return (
    <select
      className={joinClasses(
        'w-full rounded-button border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900',
        'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900',
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
      : tone === 'success'
      ? 'bg-accent-100 text-accent-600 dark:bg-emerald-900/40 dark:text-emerald-300'
      : tone === 'warning'
      ? 'bg-warning-100 text-warning-600 dark:bg-amber-900/40 dark:text-amber-300'
      : tone === 'danger'
      ? 'bg-destructive-100 text-destructive-600 dark:bg-red-900/40 dark:text-red-300'
      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
  return (
    <span className={joinClasses('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', toneClass, className)}>
      {children}
    </span>
  );
}
