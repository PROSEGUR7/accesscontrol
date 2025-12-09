"use client"

import { Activity, ArrowLeftRight, Building2, DoorClosed, FileBarChart, KeySquare, LayoutDashboard, MapPin, Users } from "lucide-react"
import type { ComponentProps } from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

const fallbackData = {
  user: {
    name: "Adriana Duarte",
    email: "admin@rfid-access.com",
  },
  teams: [
    {
      name: "RFID Access · Matriz",
      logo: Building2,
      plan: "Operación 24/7",
    },
    {
      name: "Campus Norte",
      logo: MapPin,
      plan: "Turnos mixtos",
    },
  ],
  navMain: [
    {
      title: "Panel",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Puertas",
      url: "/dashboard/doors",
      icon: DoorClosed,
    },
    {
      title: "Ubicaciones",
      url: "/dashboard/ubicaciones",
      icon: MapPin,
    },
    {
      title: "Objetos",
      url: "/dashboard/keys",
      icon: KeySquare,
    },
    {
      title: "Movimientos",
      url: "/dashboard/movimientos",
      icon: ArrowLeftRight,
    },
    {
      title: "Personal",
      url: "/dashboard/personal",
      icon: Users,
    },
    {
      title: "Reportes",
      url: "/dashboard/reports",
      icon: FileBarChart,
    },
    {
      title: "API Test",
      url: "/dashboard/api-test",
      icon: Activity,
    },
  ],
}

type AppSidebarUser = {
  name: string
  email: string
  avatar?: string
  tenant?: string
  roles?: string[]
}

type AppSidebarProps = ComponentProps<typeof Sidebar> & {
  user?: AppSidebarUser
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const resolvedUser = user ?? fallbackData.user

  const navUser = {
    name: resolvedUser.name,
    email: resolvedUser.email,
    avatar: resolvedUser.avatar,
  }

  const teams = resolveTeams(user)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={fallbackData.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={navUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function resolveTeams(user?: AppSidebarUser) {
  if (!user?.tenant) {
    return fallbackData.teams
  }

  const friendlyName = formatTenantLabel(user.tenant)
  const planLabel = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles.join(" • ") : fallbackData.teams[0]?.plan ?? "Activo"

  return [
    {
      name: friendlyName,
      logo: Building2,
      plan: planLabel,
    },
  ]
}

function formatTenantLabel(rawTenant: string) {
  const cleaned = rawTenant.replace(/^tenant[_-]?/i, "")

  if (!cleaned) {
    return rawTenant
  }

  return cleaned
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
