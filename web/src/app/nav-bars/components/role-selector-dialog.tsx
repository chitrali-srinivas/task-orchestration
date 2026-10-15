"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

const ROLES = [
  { id: "Verifier", label: "Verifier" },
  { id: "Admin", label: "Admin" },
  { id: "HQ Verifier", label: "HQ Verifier" },
  { id: "HQ Admin", label: "HQ Admin" },
]

export function RoleSelectorDialog({ children, route }: { children: React.ReactNode; route?: string }) {
  const [open, setOpen] = React.useState(false)
  const [selectedRoles, setSelectedRoles] = React.useState<string[]>([])
  const router = useRouter()

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoles((prev) => (prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]))
  }

  const handleConfirm = () => {
    if (selectedRoles.length === 0) return
    const queryString = selectedRoles.join(",")
    const targetRoute = route || "/nav-bar-type-4"
    router.push(`${targetRoute}?roles=${encodeURIComponent(queryString)}`)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Roles</DialogTitle>
          <DialogDescription>Select one or more roles to preview the navigation bar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {ROLES.map((role) => (
            <div key={role.id} className="flex items-center space-x-2">
              <Checkbox id={role.id} checked={selectedRoles.includes(role.id)} onCheckedChange={() => handleRoleToggle(role.id)} />
              <Label
                htmlFor={role.id}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {role.label}
              </Label>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm} disabled={selectedRoles.length === 0}>
            Launch Demo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

