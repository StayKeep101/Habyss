import * as React from "react"
import { Pressable, Text, View } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "flex flex-row items-center justify-center rounded-2xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-primary shadow-sm active:bg-primary/90",
        destructive: "bg-destructive shadow-sm active:bg-destructive/90",
        outline: "border border-border bg-background shadow-sm active:bg-accent active:text-accent-foreground",
        secondary: "bg-secondary shadow-sm active:bg-secondary/80",
        ghost: "active:bg-accent active:text-accent-foreground",
        link: "underline-offset-4 active:underline",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 px-4 text-sm",
        lg: "h-14 px-8 text-lg",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<typeof Pressable>,
    VariantProps<typeof buttonVariants> {
  label: React.ReactNode
  labelClassName?: string
}

const Button = React.forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  ({ className, variant, size, label, labelClassName, ...props }, ref) => {
    return (
      <Pressable
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {({ pressed }) => (
          <View className="flex-row items-center justify-center">
            <Text
              className={cn(
                "font-semibold text-foreground",
                pressed && "opacity-70",
                size === "sm" && "text-sm",
                size === "lg" && "text-lg",
                labelClassName
              )}
            >
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

