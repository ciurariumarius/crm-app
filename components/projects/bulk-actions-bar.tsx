"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { CheckSquare, Square, Loader2, Trash2 } from "lucide-react"
import { updateProject, deleteProjects } from "@/lib/actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface BulkActionsBarProps {
    selectedIds: string[]
    onClearSelection: () => void
    totalProjects: number
}

export function BulkActionsBar({ selectedIds, onClearSelection, totalProjects }: BulkActionsBarProps) {
    const router = useRouter()
    const [isUpdating, setIsUpdating] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [bulkStatus, setBulkStatus] = React.useState<string>("")
    const [bulkPayment, setBulkPayment] = React.useState<string>("")

    const handleBulkUpdate = async () => {
        if (selectedIds.length === 0) return
        if (!bulkStatus && !bulkPayment) {
            toast.error("Please select a status or payment option")
            return
        }

        setIsUpdating(true)
        try {
            const updateData: any = {}
            if (bulkStatus) updateData.status = bulkStatus
            if (bulkPayment) updateData.paymentStatus = bulkPayment

            // Update all selected projects
            await Promise.all(
                selectedIds.map(id => updateProject(id, updateData))
            )

            toast.success(`Updated ${selectedIds.length} project(s)`)
            onClearSelection()
            setBulkStatus("")
            setBulkPayment("")
            router.refresh()
        } catch (error) {
            toast.error("Bulk update failed")
        } finally {
            setIsUpdating(false)
        }
    }

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return

        setIsDeleting(true)
        try {
            const result = await deleteProjects(selectedIds)
            if (result.success) {
                toast.success(`Deleted ${selectedIds.length} project(s)`)
                onClearSelection()
                router.refresh()
            } else {
                toast.error(result.error || "Bulk delete failed")
            }
        } catch (error) {
            toast.error("Bulk delete failed")
        } finally {
            setIsDeleting(false)
        }
    }

    if (selectedIds.length === 0) return null

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-2xl rounded-2xl p-4 flex items-center gap-4 min-w-[600px]">
            <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary" />
                <span className="text-sm font-bold">
                    {selectedIds.length} of {totalProjects} selected
                </span>
            </div>

            <div className="h-8 w-px bg-border" />

            <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-[140px] h-9 text-xs font-medium">
                    <SelectValue placeholder="Set Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Paused">Paused</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
            </Select>

            <Select value={bulkPayment} onValueChange={setBulkPayment}>
                <SelectTrigger className="w-[140px] h-9 text-xs font-medium">
                    <SelectValue placeholder="Set Payment" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                </SelectContent>
            </Select>

            <Button
                onClick={handleBulkUpdate}
                disabled={isUpdating || (!bulkStatus && !bulkPayment)}
                size="sm"
                className="ml-auto"
            >
                {isUpdating ? (
                    <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                    </>
                ) : (
                    "Apply Changes"
                )}
            </Button>

            <Button
                onClick={onClearSelection}
                variant="ghost"
                size="sm"
            >
                Clear
            </Button>

            <div className="h-8 w-px bg-border mx-2" />

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="destructive"
                        size="sm"
                        disabled={isUpdating || isDeleting}
                    >
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selectedIds.length} Projects?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the selected projects and all associated data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleBulkDelete}
                            className="bg-rose-500 hover:bg-rose-600"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
