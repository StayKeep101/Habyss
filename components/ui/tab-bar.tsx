import * as React from "react"
import { View, Pressable, Text } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { cn } from "@/lib/utils"
import { useColorScheme } from "@/hooks/useColorScheme"
import { Colors } from "@/constants/Colors"

export interface TabBarItemProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  isActive?: boolean
  onPress: () => void
}

const TabBarItem: React.FC<TabBarItemProps> = ({ icon, label, isActive, onPress }) => {
  const colorScheme = useColorScheme()
  const colors = Colors[colorScheme ?? 'dark']
  
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "flex-1 items-center justify-center rounded-2xl mx-1 py-3 px-2",
        isActive && "bg-primary/10"
      )}
      style={{
        backgroundColor: isActive ? colors.primary + '15' : 'transparent',
      }}
    >
      {({ pressed }) => (
        <View className="items-center">
          <Ionicons
            name={icon}
            size={24}
            color={isActive ? colors.primary : colors.textTertiary}
            style={{ opacity: pressed ? 0.7 : 1 }}
          />
          <Text
            className={cn(
              "text-xs font-medium mt-1",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
            style={{
              color: isActive ? colors.primary : colors.textTertiary,
              opacity: pressed ? 0.7 : 1,
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

export interface TabBarProps {
  children: React.ReactNode
}

const TabBar: React.FC<TabBarProps> = ({ children }) => {
  const colorScheme = useColorScheme()
  const colors = Colors[colorScheme ?? 'dark']
  
  return (
    <View
      className="absolute bottom-0 left-0 right-0 bg-background border-t border-border"
      style={{
        backgroundColor: colors.background,
        borderTopColor: colors.border,
        borderTopWidth: 0.5,
        paddingBottom: 34, // Safe area for iPhone
        paddingTop: 8,
        paddingHorizontal: 16,
      }}
    >
      <View className="flex-row items-center justify-around rounded-3xl py-2" style={{ backgroundColor: colors.surfaceSecondary }}>
        {children}
      </View>
    </View>
  )
}

export { TabBar, TabBarItem }

