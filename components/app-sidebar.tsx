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
}

type AppSidebarProps = ComponentProps<typeof Sidebar> & {
  user?: AppSidebarUser
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const resolvedUser = user ?? fallbackData.user

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={fallbackData.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={fallbackData.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={resolvedUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
