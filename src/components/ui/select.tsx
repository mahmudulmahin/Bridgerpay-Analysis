import * as React from "react"

interface SelectProps {
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

interface SelectContentProps {
  children: React.ReactNode
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
}

interface SelectValueProps {
  placeholder?: string
}

const SelectContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}>({
  value: '',
  onValueChange: () => {},
  open: false,
  setOpen: () => {}
})

const Select = ({ onValueChange, children }: SelectProps) => {
  const [value, setValue] = React.useState('')
  const [open, setOpen] = React.useState(false)
  
  const handleValueChange = (newValue: string) => {
    setValue(newValue)
    onValueChange?.(newValue)
    setOpen(false)
  }
  
  return (
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen } = React.useContext(SelectContext)
    
    return (
      <button
        ref={ref}
        className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
        onClick={() => setOpen(!open)}
        {...props}
      >
        {children}
        <svg
          className="h-4 w-4 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      </button>
    )
  }
)
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = ({ placeholder }: SelectValueProps) => {
  const { value } = React.useContext(SelectContext)
  return <span>{value || placeholder}</span>
}

const SelectContent = ({ children }: SelectContentProps) => {
  const { open } = React.useContext(SelectContext)
  
  if (!open) return null
  
  return (
    <div className="absolute top-full z-50 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
      {children}
    </div>
  )
}

const SelectItem = ({ value, children }: SelectItemProps) => {
  const { onValueChange } = React.useContext(SelectContext)
  
  return (
    <div
      className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
      onClick={() => onValueChange(value)}
    >
      {children}
    </div>
  )
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }