import { Stack } from "expo-router";

// Onboarding is one route with internal steps, so back navigation and a
// resumable draft stay in one place rather than spread across screens.
const AuthenticationLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
    </Stack>
  );
};

export default AuthenticationLayout;
