import * as React from "react"

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

interface DialogContentProps {
  className?: string
  children: React.ReactNode
}

interface DialogHeaderProps {
  children: React.ReactNode
}

interface DialogTitleProps {
  children: React.ReactNode
}

interface DialogDescriptionProps {
  children: React.ReactNode
}

const DialogContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
}>({
  open: false,
  onOpenChange: () => {}
})

const Dialog = ({ open = false, onOpenChange, children }: DialogProps) => {
  return (
    <DialogContext.Provider value={{ open, onOpenChange: onOpenChange || (() => {}) }}>
      {children}
    </DialogContext.Provider>
  )
}

const DialogContent = ({ className, children }: DialogContentProps) => {
  const { open, onOpenChange } = React.useContext(DialogContext)
  
  if (!open) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className={`relative z-50 grid w-full gap-4 border bg-background p-6 shadow-lg sm:rounded-lg ${className || ''}`}>
        {children}
      </div>
    </div>
  )
}

const DialogHeader = ({ children }: DialogHeaderProps) => (
  <div className="flex flex-col space-y-1.5 text-center sm:text-left">
    {children}
  </div>
)

const DialogTitle = ({ children }: DialogTitleProps) => (
  <h2 className="text-lg font-semibold leading-none tracking-tight">
    {children}
  </h2>
)

const DialogDescription = ({ children }: DialogDescriptionProps) => (
  <p className="text-sm text-muted-foreground">
    {children}
  </p>
)

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription }