import * as React from "react"
import { TextInput, View } from "react-native"
import { cn } from "@/lib/utils"
import { useColorScheme } from "@/hooks/useColorScheme"
import { Colors } from "@/constants/Colors"

export interface InputProps extends React.ComponentPropsWithoutRef<typeof TextInput> {
  label?: string
  error?: string
}

const Input = React.forwardRef<React.ElementRef<typeof TextInput>, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    const colorScheme = useColorScheme()
    const colors = Colors[colorScheme ?? 'dark']
    
    return (
      <View className="space-y-2">
        {label && (
          <View>
            <TextInput
              className={cn("text-sm font-medium text-foreground")}
              style={{ color: colors.textSecondary }}
              editable={false}
              value={label}
            />
          </View>
        )}
        <TextInput
          className={cn(
            "flex h-12 rounded-2xl border border-input bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive",
            className
          )}
          style={{
            backgroundColor: colors.surfaceSecondary,
            borderColor: error ? colors.error : colors.border,
            color: colors.textPrimary,
            placeholderTextColor: colors.textTertiary,
          }}
          ref={ref}
          {...props}
        />
        {error && (
          <View>
            <TextInput
              className="text-sm text-destructive"
              style={{ color: colors.error }}
              editable={false}
              value={error}
            />
          </View>
        )}
      </View>
    )
  }
)
Input.displayName = "Input"

export { Input }

