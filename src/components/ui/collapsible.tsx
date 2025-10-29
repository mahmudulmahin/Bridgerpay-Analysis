import * as React from "react"

interface CollapsibleProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

interface CollapsibleTriggerProps {
  asChild?: boolean
  children: React.ReactNode
}

interface CollapsibleContentProps {
  className?: string
  children: React.ReactNode
}

const CollapsibleContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
}>({
  open: false,
  onOpenChange: () => {}
})

const Collapsible = ({ open = false, onOpenChange, children }: CollapsibleProps) => {
  const [internalOpen, setInternalOpen] = React.useState(open)
  
  const handleOpenChange = (newOpen: boolean) => {
    setInternalOpen(newOpen)
    onOpenChange?.(newOpen)
  }
  
  React.useEffect(() => {
    setInternalOpen(open)
  }, [open])
  
  return (
    <CollapsibleContext.Provider value={{ open: internalOpen, onOpenChange: handleOpenChange }}>
      {children}
    </CollapsibleContext.Provider>
  )
}

const CollapsibleTrigger = ({ asChild, children }: CollapsibleTriggerProps) => {
  const { open, onOpenChange } = React.useContext(CollapsibleContext)
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: () => onOpenChange(!open)
    } as any)
  }
  
  return (
    <button onClick={() => onOpenChange(!open)}>
      {children}
    </button>
  )
}

const CollapsibleContent = ({ className, children }: CollapsibleContentProps) => {
  const { open } = React.useContext(CollapsibleContext)
  
  if (!open) return null
  
  return (
    <div className={className}>
      {children}
    </div>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }