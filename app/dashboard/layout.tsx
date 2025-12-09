import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import { getAuthenticatedUserById, getSessionFromCookies } from '@/lib/auth'

import { DashboardShell } from './dashboard-shell'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSessionFromCookies()

  if (!session) {
    redirect('/')
  }

  const user = await getAuthenticatedUserById(session.sub, session.tenant)

  if (!user) {
    redirect('/')
  }

  return (
    <DashboardShell
      user={{
        name: user.nombre,
        email: user.email,
        roles: user.roles,
        tenant: session.tenant,
      }}
    >
      {children}
    </DashboardShell>
  )
}
