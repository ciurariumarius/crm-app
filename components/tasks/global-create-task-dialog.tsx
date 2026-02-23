"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { addTask } from "@/lib/actions"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Calendar as CalendarIcon, Check, ChevronsUpDown } from "lucide-react"
import { formatProjectName } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { QuickActionProject } from "@/types"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"

import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"

interface GlobalCreateTaskDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projects: QuickActionProject[]
}

export function GlobalCreateTaskDialog({ open, onOpenChange, projects }: GlobalCreateTaskDialogProps) {
    const [name, setName] = useState("")
    const [selectedProjectId, setSelectedProjectId] = useState("")
    const [status, setStatus] = useState("Active")
    const [urgency, setUrgency] = useState("Normal")
    const [deadline, setDeadline] = useState<Date>()
    const [estimatedMinutes, setEstimatedMinutes] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)
    const [showCompleted, setShowCompleted] = useState(false)
    const [openPopover, setOpenPopover] = useState(false)
    const [openCombobox, setOpenCombobox] = useState(false)

    // Filter projects based on the "showCompleted" toggle
    const displayProjects = projects.filter(p => showCompleted || p.status === "Active")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedProjectId) return

        setIsLoading(true)
        try {
            const result = await addTask(selectedProjectId, name, {
                status,
                urgency,
                deadline,
                estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined
            })
            if (result.success) {
                toast.success("Task created")
                setName("")
                setSelectedProjectId("")
                setStatus("Active")
                setUrgency("Normal")
                setDeadline(undefined)
                setEstimatedMinutes("")
                setShowCompleted(false)
                onOpenChange(false)
            } else {
                toast.error(result.error || "Failed to create task")
            }
        } catch (error) {
            toast.error("Process failed")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[90vh]">
                <DialogHeader className="p-8 pb-5 border-b">
                    <DialogTitle className="text-2xl font-bold tracking-tight">Add New Task</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-8 py-6 space-y-6 scrollbar-thin scrollbar-thumb-primary/10">
                        <div className="space-y-3 flex flex-col">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">01. Target Project</Label>
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="show-completed" className="text-[10px] uppercase font-bold text-muted-foreground/40 cursor-pointer tracking-wider">Search in completed</Label>
                                    <Switch
                                        id="show-completed"
                                        checked={showCompleted}
                                        onCheckedChange={setShowCompleted}
                                        className="scale-75 origin-right"
                                    />
                                </div>
                            </div>
                            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openCombobox}
                                        className="w-full justify-between h-12 bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20 whitespace-normal text-left font-bold"
                                    >
                                        {selectedProjectId
                                            ? formatProjectName(projects.find((p) => p.id === selectedProjectId)!)
                                            : "Select a project..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[500px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search project..." />
                                        <CommandList>
                                            <CommandEmpty>No project found.</CommandEmpty>
                                            <CommandGroup>
                                                {displayProjects.map((p) => (
                                                    <CommandItem
                                                        key={p.id}
                                                        value={formatProjectName(p)}
                                                        onSelect={() => {
                                                            setSelectedProjectId(p.id)
                                                            setOpenCombobox(false)
                                                        }}
                                                        className="flex items-center justify-between py-3"
                                                    >
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <Check
                                                                className={cn(
                                                                    "h-4 w-4 shrink-0",
                                                                    selectedProjectId === p.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <span className="truncate leading-tight font-medium">{formatProjectName(p)}</span>
                                                        </div>
                                                        {p.status !== "Active" && (
                                                            <Badge variant="outline" className={cn(
                                                                "text-[9px] font-black uppercase ml-2 flex-shrink-0 px-1.5 py-0 h-4 border-dashed",
                                                                p.status === "Completed" ? "text-blue-500 border-blue-500/30" : "text-amber-500 border-amber-500/30"
                                                            )}>
                                                                {p.status}
                                                            </Badge>
                                                        )}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">02. Task Name</Label>
                            <Input
                                placeholder="ex. Verificare dataLayer"
                                className="h-12 bg-muted/30 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-bold"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">03. Status</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger className="h-12 bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Active" className="font-bold">ACTIVE</SelectItem>
                                        <SelectItem value="Paused" className="font-bold">PAUSED</SelectItem>
                                        <SelectItem value="Completed" className="font-bold">COMPLETED</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">04. Priority</Label>
                                <Select value={urgency} onValueChange={setUrgency}>
                                    <SelectTrigger className="h-12 bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Normal" className="font-bold">NORMAL</SelectItem>
                                        <SelectItem value="Urgent" className="font-bold">URGENT</SelectItem>
                                        <SelectItem value="Idea" className="font-bold">IDEA</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-3 flex flex-col">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">05. Deadline</Label>
                                <Popover open={openPopover} onOpenChange={setOpenPopover}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "pl-3 text-left font-bold w-full justify-start h-12 bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20",
                                                !deadline && "text-muted-foreground font-normal"
                                            )}
                                            type="button"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                                            {deadline ? format(deadline, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={deadline}
                                            onSelect={(d) => {
                                                setDeadline(d)
                                                setOpenPopover(false)
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">06. Est. Time (min)</Label>
                                <Input
                                    type="number"
                                    placeholder="ex. 60"
                                    className="h-12 bg-muted/30 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-bold"
                                    value={estimatedMinutes}
                                    onChange={(e) => setEstimatedMinutes(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-8 bg-muted/5 border-t">
                        <Button
                            type="submit"
                            disabled={isLoading || !selectedProjectId || !name}
                            className="w-full h-14 text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 rounded-xl"
                        >
                            {isLoading ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    CREATE TASK <Check className="h-5 w-5" />
                                </span>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
