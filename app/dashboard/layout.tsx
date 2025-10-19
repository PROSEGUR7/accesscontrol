'use client'

import { Fragment, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { AppSidebar } from '@/components/app-sidebar'
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

const breadcrumbMap: Record<string, { label: string; href?: string; hideOnMobile?: boolean }[]> = {
  '/dashboard': [
    { label: 'Inicio', href: '/dashboard' },
    { label: 'Panel', hideOnMobile: true },
  ],
  '/dashboard/doors': [
    { label: 'Inicio', href: '/dashboard' },
    { label: 'Puertas' },
  ],
  '/dashboard/keys': [
    { label: 'Inicio', href: '/dashboard' },
    { label: 'Llaves RFID' },
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

const defaultBreadcrumb = [{ label: 'Inicio', href: '/dashboard' }]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const breadcrumbs = breadcrumbMap[pathname] ?? defaultBreadcrumb

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => {
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
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
