"use client"

import { Building2, DoorClosed, FileBarChart, KeySquare, LayoutDashboard, MapPin, Users } from "lucide-react"

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

const data = {
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
      title: "Llaves RFID",
      url: "/dashboard/keys",
      icon: KeySquare,
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
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
