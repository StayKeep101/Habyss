// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "lib/_premium/**/*", "supabase/functions/**/*"],
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["components/Common/AppIcon.tsx", "**/__tests__/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@expo/vector-icons", "@expo/vector-icons/*", "lucide-react-native", "react-native-vector-icons", "react-native-vector-icons/*", "@react-native-vector-icons/*"],
          message: "Use AppIcon from @/components/Common/AppIcon so all interface icons use Ionicons.",
        }],
      }],
    },
  },
  {
    files: ["jest.setup.js"],
    languageOptions: {
      globals: {
        jest: "readonly",
        require: "readonly",
      },
    },
  }
]);
