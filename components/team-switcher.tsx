"use client"

import type { ComponentType, SVGProps } from "react"

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

type Team = {
  name: string
  plan: string
  logo: ComponentType<SVGProps<SVGSVGElement>>
}

interface TeamSwitcherProps {
  teams: Team[]
}

export function TeamSwitcher({ teams }: TeamSwitcherProps) {
  const activeTeam = teams[0]

  if (!activeTeam) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="justify-start gap-3" tooltip={activeTeam.name}>
          <div className="flex size-10 items-center justify-center rounded-lg border border-border/50 bg-primary/10 text-primary">
            <activeTeam.logo className="size-5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-semibold leading-tight">{activeTeam.name}</span>
            <span className="text-xs text-muted-foreground">{activeTeam.plan}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
