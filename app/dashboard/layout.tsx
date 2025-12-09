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

  const nameMismatch = session.nombre && user.nombre && session.nombre.trim() !== user.nombre.trim()

  const displayName = session.nombre ?? user.nombre ?? 'Usuario'
  const displayEmail = nameMismatch
    ? session.email ?? 'correo-no-disponible'
    : session.email ?? user.email ?? 'correo-no-disponible'

  return (
    <DashboardShell
      user={{
        name: displayName,
        email: displayEmail,
        roles: user.roles?.length ? user.roles : session.roles ?? [],
        tenant: session.tenant,
      }}
    >
      {children}
    </DashboardShell>
  )
}
