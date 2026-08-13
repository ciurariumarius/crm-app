import * as React from "react"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { cn } from "@/lib/utils"

export type AppPageHeaderProps = {
  title: string
  subtitle?: string
  description?: string
  eyebrow?: string
  search?: React.ReactNode
  primaryAction?: React.ReactNode
  secondaryActions?: React.ReactNode
  mobileSearch?: React.ReactNode
  mobilePrimaryAction?: React.ReactNode
  tabletSearch?: React.ReactNode
  tabletPrimaryAction?: React.ReactNode
  className?: string
}

function duplicateNode(node: React.ReactNode) {
  if (!React.isValidElement(node)) return node
  return React.cloneElement(node)
}

function HeaderIdentity({
  title,
  subtitle,
  eyebrow,
  includeMenu = false,
}: {
  title: string
  subtitle?: string
  eyebrow?: string
  includeMenu?: boolean
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {includeMenu ? <MobileMenuTrigger /> : null}
      <div className="min-w-0 pt-0.5">
        {eyebrow ? <p className="ui-overline truncate">{eyebrow}</p> : null}
        <h1 className="ui-text-title truncate text-[var(--text-primary)]">{title}</h1>
        {subtitle ? (
          <p className="mt-1 max-w-2xl text-[13px] font-medium leading-5 text-[var(--text-secondary)] md:leading-6">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function AppPageHeader({
  title,
  subtitle,
  description,
  eyebrow,
  search,
  primaryAction,
  secondaryActions,
  mobileSearch,
  mobilePrimaryAction,
  tabletSearch,
  tabletPrimaryAction,
  className,
}: AppPageHeaderProps) {
  const resolvedSubtitle = subtitle ?? description
  const resolvedMobileSearch = mobileSearch ?? duplicateNode(search)
  const resolvedMobileAction = mobilePrimaryAction ?? duplicateNode(primaryAction)
  const resolvedTabletSearch = tabletSearch ?? duplicateNode(search)
  const resolvedTabletAction = tabletPrimaryAction ?? duplicateNode(primaryAction)

  return (
    <header
      data-slot="app-page-header"
      className={cn(
        "rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4 shadow-[var(--shadow-apple)] md:px-5 md:py-4 xl:px-6",
        className
      )}
    >
      <div className="flex flex-col gap-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <HeaderIdentity title={title} subtitle={resolvedSubtitle} eyebrow={eyebrow} includeMenu />
          {resolvedMobileAction ? <div className="shrink-0">{resolvedMobileAction}</div> : null}
        </div>
        {resolvedMobileSearch}
        {secondaryActions ? <div className="flex flex-wrap items-center gap-2">{secondaryActions}</div> : null}
      </div>

      <div className="hidden items-center gap-4 md:grid md:grid-cols-[minmax(180px,1fr)_minmax(280px,640px)_minmax(160px,1fr)] xl:grid-cols-[minmax(240px,1fr)_minmax(360px,640px)_minmax(240px,1fr)]">
        <HeaderIdentity title={title} subtitle={resolvedSubtitle} eyebrow={eyebrow} />
        {resolvedTabletSearch ? <div className="w-full justify-self-center">{resolvedTabletSearch}</div> : <div />}
        <div className="flex min-w-0 items-center justify-end gap-2.5">
          {secondaryActions}
          {resolvedTabletAction ? <div className="shrink-0">{resolvedTabletAction}</div> : null}
        </div>
      </div>
    </header>
  )
}
