'use client'

import { Fragment, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { AppSidebar } from '@/components/app-sidebar'
import { ModeToggle } from '@/components/ui/mode-toggle'
import { ThemeSelect } from '@/components/ui/theme-select'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

type BreadcrumbMeta = { label: string; href?: string; hideOnMobile?: boolean }
type DashboardShellUser = {
  name: string
  email: string
  avatar?: string
  roles?: string[]
  tenant?: string
}

const breadcrumbMap: Record<string, BreadcrumbMeta[]> = {
  '/dashboard': [
    { label: 'Inicio', href: '/dashboard' },
    { label: 'Panel', hideOnMobile: true },
  ],
  '/dashboard/doors': [
    { label: 'Inicio', href: '/dashboard' },
    { label: 'Puertas' },
  ],
  '/dashboard/api-test': [
    { label: 'Inicio', href: '/dashboard' },
    { label: 'API Test' },
  ],
  '/dashboard/keys': [
    { label: 'Inicio', href: '/dashboard' },
    { label: 'Objetos' },
  ],
  '/dashboard/ubicaciones': [
    { label: 'Inicio', href: '/dashboard' },
    { label: 'Ubicaciones' },
  ],
  '/dashboard/movimientos': [
    { label: 'Inicio', href: '/dashboard' },
    { label: 'Movimientos' },
  ],
  '/dashboard/personal': [
    { label: 'Inicio', href: '/dashboard' },
    { label: 'Personal' },
  ],
  '/dashboard/reports': [
    { label: 'Inicio', href: '/dashboard' },
    { label: 'Reportes' },
  ],
}

const defaultBreadcrumb: BreadcrumbMeta[] = [{ label: 'Inicio', href: '/dashboard' }]

type DashboardShellProps = {
  children: ReactNode
  user: DashboardShellUser
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const pathname = usePathname() ?? '/dashboard'
  const breadcrumbs = breadcrumbMap[pathname] ?? defaultBreadcrumb

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 bg-background/95 px-3 shadow-sm backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 sm:h-16 sm:px-4">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 hidden h-5 data-[orientation=vertical]:h-4 sm:block" />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb: BreadcrumbMeta, index: number) => {
                  const isLast = index === breadcrumbs.length - 1

                  return (
                    <Fragment key={`${crumb.label}-${index}`}>
                      <BreadcrumbItem className={crumb.hideOnMobile ? 'hidden md:block' : undefined}>
                        {isLast ? (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        ) : crumb.href ? (
                          <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                      {!isLast ? <BreadcrumbSeparator className={crumb.hideOnMobile ? 'hidden md:block' : undefined} /> : null}
                    </Fragment>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ModeToggle />
            <ThemeSelect />
          </div>
        </header>
        <div
          className="flex flex-1 flex-col gap-4 p-3 pt-0 sm:p-4 transition-all md:ml-0 group-data-[state=expanded]/sidebar-wrapper:md:ml-[16rem] group-data-[collapsible=icon][data-state=collapsed]/sidebar-wrapper:md:ml-[3rem]"
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
