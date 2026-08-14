import * as React from "react"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { cn } from "@/lib/utils"

export type AppPageHeaderProps = {
  title: string
  subtitle?: string
  description?: string
  eyebrow?: string
  search?: React.ReactNode
  controls?: React.ReactNode
  primaryAction?: React.ReactNode
  secondaryActions?: React.ReactNode
  footer?: React.ReactNode
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
  controls,
  primaryAction,
  secondaryActions,
  footer,
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
        {controls || secondaryActions ? (
          <div className="flex min-w-0 items-center gap-2">
            {controls ? <div className="min-w-0 flex-1">{controls}</div> : null}
            {secondaryActions ? <div className="ml-auto shrink-0">{secondaryActions}</div> : null}
          </div>
        ) : null}
        {footer}
      </div>

      {controls ? (
        <div className="hidden items-center gap-x-4 gap-y-3 md:grid md:grid-cols-[minmax(180px,1fr)_minmax(280px,640px)_auto] xl:grid-cols-[minmax(150px,auto)_minmax(320px,1.8fr)_auto_auto_auto]">
          <div className="md:col-start-1 md:row-start-1 xl:col-start-1">
            <HeaderIdentity title={title} subtitle={resolvedSubtitle} eyebrow={eyebrow} />
          </div>
          <div className="min-w-0 md:col-start-1 md:row-start-2 xl:col-start-3 xl:row-start-1">
            {controls}
          </div>
          {resolvedTabletSearch ? (
            <div className="w-full justify-self-center md:col-start-2 md:row-start-1 xl:col-start-2">
              {resolvedTabletSearch}
            </div>
          ) : <div />}
          {secondaryActions ? (
            <div className="flex min-w-0 items-center justify-end md:col-span-2 md:col-start-2 md:row-start-2 xl:col-span-1 xl:col-start-4 xl:row-start-1">
              {secondaryActions}
            </div>
          ) : null}
          {resolvedTabletAction ? (
            <div className="shrink-0 md:col-start-3 md:row-start-1 xl:col-start-5">
              {resolvedTabletAction}
            </div>
          ) : null}
          {footer ? (
            <div className="min-w-0 md:col-span-3 md:row-start-3 xl:col-span-5 xl:row-start-2">
              {footer}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="hidden items-center gap-4 md:grid md:grid-cols-[minmax(180px,1fr)_minmax(280px,640px)_minmax(160px,1fr)] xl:grid-cols-[minmax(240px,1fr)_minmax(360px,640px)_minmax(240px,1fr)]">
          <HeaderIdentity title={title} subtitle={resolvedSubtitle} eyebrow={eyebrow} />
          {resolvedTabletSearch ? <div className="w-full justify-self-center">{resolvedTabletSearch}</div> : <div />}
          <div className="flex min-w-0 items-center justify-end gap-2.5">
            {secondaryActions}
            {resolvedTabletAction ? <div className="shrink-0">{resolvedTabletAction}</div> : null}
          </div>
          {footer ? <div className="col-span-3">{footer}</div> : null}
        </div>
      )}
    </header>
  )
}
