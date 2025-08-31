# Habyss - All-in-One Personal Improvement App

![Habyss Logo](assets/images/Habyss%20Logo%20Black%20BG.png)

## 🌟 Overview

Habyss is a comprehensive personal improvement app that combines habit tracking, focus timers, AI assistance, and wellness monitoring into one beautiful, modern interface. Built with React Native and Expo, it follows the minimalist design philosophy with a focus on user experience and productivity.

## ✨ Features

### 🎯 Core Features
- **Habit Tracking**: Create, track, and maintain daily habits with streak counting
- **Focus Timer**: Pomodoro technique, deep focus sessions, and break timers
- **AI Assistant**: Personalized habit creation, goal setting, and motivation
- **Progress Analytics**: Detailed statistics and progress visualization
- **Modern UI**: Beautiful, minimalist interface with smooth animations

### 🎨 Design System
- **Theme**: Blue gradient and black background inspired by the Habyss logo
- **Dark/Light Mode**: Automatic theme switching based on system preferences
- **Haptic Feedback**: Tactile responses for better user interaction
- **Smooth Animations**: Subtle animations throughout the app

### 📱 Platform Support
- **iOS**: Full native support with iOS-specific features
- **Android**: Optimized for Android devices
- **Cross-Platform**: Consistent experience across all devices

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/habyss.git
   cd habyss
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Run on your device**
   - Scan the QR code with Expo Go app (iOS/Android)
   - Press `i` for iOS simulator
   - Press `a` for Android emulator

## 📁 Project Structure

```
habyss/
├── app/                    # Main application screens
│   ├── (auth)/            # Authentication screens
│   ├── (root)/            # Main app screens
│   │   ├── (tabs)/        # Tab navigation screens
│   │   ├── focus.tsx      # Focus timer screen
│   │   ├── ai.tsx         # AI chat screen
│   │   └── ...
├── components/            # Reusable UI components
├── constants/             # App constants and themes
├── hooks/                 # Custom React hooks
├── assets/                # Images, fonts, and static files
└── ...
```

## 🎯 Key Screens

### Home Screen
- Daily habit overview
- Quick stats and progress
- Focus session shortcuts
- Quick actions

### Focus Timer
- Pomodoro technique (25/5)
- Deep focus sessions (90 min)
- Short breaks (5 min)
- Long breaks (15 min)
- Progress visualization

### AI Assistant
- Habit creation guidance
- Goal setting assistance
- Progress tracking
- Motivational support
- Daily planning

## 🛠️ Technology Stack

- **Framework**: React Native with Expo
- **Navigation**: Expo Router
- **Styling**: NativeWind (Tailwind CSS)
- **Icons**: Expo Vector Icons
- **State Management**: React Hooks
- **Animations**: React Native Animated API

## 🎨 Design Philosophy

### Color Scheme
- **Primary**: Blue gradient (#3B82F6 to #1D4ED8)
- **Background**: Black (#000000) / White (#FFFFFF)
- **Surface**: Slate variations for depth
- **Accent**: Indigo, Violet, Emerald, Amber

### Typography
- Clean, modern sans-serif fonts
- Hierarchical text sizing
- High contrast for readability

### Interactions
- Haptic feedback on all interactions
- Smooth transitions and animations
- Intuitive gesture controls

## 🔧 Configuration

### App Configuration (`app.json`)
```json
{
  "expo": {
    "name": "Habyss",
    "slug": "Habyss",
    "version": "1.0.0",
    "icon": "./assets/images/Habyss Logo Black BG.png",
    "userInterfaceStyle": "automatic"
  }
}
```

### Theme Configuration (`constants/Colors.ts`)
- Light and dark theme colors
- Semantic color naming
- Consistent color palette

## 📊 Features Roadmap

### Phase 1 (Current)
- ✅ Basic habit tracking
- ✅ Focus timer
- ✅ AI chat interface
- ✅ Modern UI/UX

### Phase 2 (Planned)
- 🔄 Health integration (Apple Health, Google Fit)
- 🔄 Social features and challenges
- 🔄 Advanced analytics
- 🔄 Custom habit templates

### Phase 3 (Future)
- 🔄 Wearable device support
- 🔄 Voice commands
- 🔄 Machine learning insights
- 🔄 Cross-platform sync

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Design inspiration from modern productivity apps
- Community feedback and suggestions
- Open source contributors

## 📞 Support

For support, email support@habyss.app or join our Discord community.

---

**Made with ❤️ for productivity and personal growth**
