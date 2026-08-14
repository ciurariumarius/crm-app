"use client"

import * as React from "react"
import { Loader2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { createLmsWorkClient } from "@/lib/actions/lms-work-entries"
import type { LmsWorkClientOption } from "@/lib/lms-work-entries/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AddLmsClientDialog({
  open,
  onOpenChange,
  onCreated,
  initialName = "",
  wording = "client",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (client: LmsWorkClientOption) => void
  initialName?: string
  wording?: "client" | "project"
}) {
  const [name, setName] = React.useState(initialName)
  const [saving, setSaving] = React.useState(false)
  const isProject = wording === "project"
  const entityLabel = isProject ? "LMS project" : "client"

  React.useEffect(() => {
    if (open) setName(initialName)
  }, [initialName, open])

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen && !saving) setName("")
    onOpenChange(nextOpen)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (!name.trim()) return

    setSaving(true)
    const result = await createLmsWorkClient(name)
    setSaving(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }

    onCreated(result.client)
    setName("")
    onOpenChange(false)
    toast.success(result.existed
      ? `Existing ${entityLabel} selected`
      : `${isProject ? "LMS project" : "Client"} added and selected`)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isProject ? "Add LMS project" : "Add client"}</DialogTitle>
          <DialogDescription>
            Enter the LMS {isProject ? "project" : "client"} name or domain. If it already exists, it will be selected instead of duplicated.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-lms-client">{isProject ? "LMS project" : "Client"} name or domain</Label>
            <Input
              id="new-lms-client"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="example.ro"
              maxLength={255}
              disabled={saving}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="animate-spin" /> : <UserPlus />}
              {saving ? "Adding…" : isProject ? "Add project" : "Add client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
