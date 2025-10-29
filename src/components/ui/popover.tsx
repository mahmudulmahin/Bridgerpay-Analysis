import * as React from "react"

interface PopoverProps {
  children: React.ReactNode
}

interface PopoverTriggerProps {
  asChild?: boolean
  children: React.ReactNode
}

interface PopoverContentProps {
  className?: string
  align?: 'start' | 'center' | 'end'
  children: React.ReactNode
}

const PopoverContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
}>({
  open: false,
  setOpen: () => {}
})

const Popover = ({ children }: PopoverProps) => {
  const [open, setOpen] = React.useState(false)
  
  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div className="relative">
        {children}
      </div>
    </PopoverContext.Provider>
  )
}

const PopoverTrigger = ({ asChild, children }: PopoverTriggerProps) => {
  const { open, setOpen } = React.useContext(PopoverContext)
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: () => setOpen(!open)
    } as any)
  }
  
  return (
    <button onClick={() => setOpen(!open)}>
      {children}
    </button>
  )
}

const PopoverContent = ({ className, align = 'center', children }: PopoverContentProps) => {
  const { open, setOpen } = React.useContext(PopoverContext)
  
  if (!open) return null
  
  const alignmentClasses = {
    start: 'left-0',
    center: 'left-1/2 transform -translate-x-1/2',
    end: 'right-0'
  }
  
  return (
    <>
      <div 
        className="fixed inset-0 z-40"
        onClick={() => setOpen(false)}
      />
      <div className={`absolute top-full z-50 mt-1 rounded-md border bg-popover p-4 text-popover-foreground shadow-md ${alignmentClasses[align]} ${className || ''}`}>
        {children}
      </div>
    </>
  )
}

export { Popover, PopoverTrigger, PopoverContent }