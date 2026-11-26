// Jest setup file for React Native
// Note: @testing-library/react-native now includes jest matchers built-in (v12.4+)

// Mock the llama.cpp provider (Gemma, offline) since it has native dependencies
jest.mock('@react-native-ai/llama', () => ({
  llama: {
    languageModel: jest.fn(() => ({
      prepare: jest.fn(),
      unload: jest.fn(),
    })),
  },
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  useSegments: jest.fn(() => []),
}));

// Mock expo modules that might not be available in test environment
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Reanimated, as much of it as a test needs. The library's own mock pulls in
// its native worklets setup, which cannot run under Jest.
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text, ScrollView, Image } = require('react-native');
  const shared = (value) => ({
    value,
    get() { return this.value; },
    set(next) { this.value = typeof next === 'function' ? next(this.value) : next; },
  });
  const identity = (value) => value;
  const builder = () => new Proxy(function () {}, {
    get: (_target, key) => (typeof key === 'symbol' ? undefined : () => builder()),
    apply: () => builder(),
  });
  const Animated = {
    View, Text, ScrollView, Image,
    createAnimatedComponent: (Component) => Component,
  };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (initial) => React.useRef(shared(initial)).current,
    useAnimatedStyle: (factory) => factory(),
    useAnimatedScrollHandler: () => () => undefined,
    useAnimatedRef: () => React.useRef(null),
    useDerivedValue: (factory) => shared(factory()),
    useAnimatedProps: (factory) => factory(),
    // The reaction runs once for the first value, which is what a render test
    // needs: the effect of scrubbing is exercised by calling the callback.
    useAnimatedReaction: (prepare, react) => { react(prepare(), undefined); },
    // Gesture handler asks Reanimated for an event handler when a
    // GestureDetector mounts. Without this the charts cannot even render here,
    // never mind be dragged; the drag itself is still not exercisable, because
    // it happens on a thread Jest does not have.
    useEvent: () => ({ current: null, workletEventHandler: undefined }),
    useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
    setGestureState: () => undefined,
    useReducedMotion: () => false,
    useAnimatedKeyboard: () => ({ height: shared(0), state: shared(0) }),
    withTiming: identity,
    withSpring: identity,
    withDelay: (_delay, value) => value,
    withSequence: (...values) => values[values.length - 1],
    withRepeat: identity,
    cancelAnimation: () => undefined,
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    interpolate: (value, input, output) => output?.[output.length - 1] ?? value,
    interpolateColor: (_value, _input, output) => output?.[0],
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    Easing: new Proxy({}, { get: () => (...args) => args[0] }),
    // Entering/exiting/layout builders chain without end in Reanimated
    // (`FadeIn.duration(160).delay(40)`), so the mock answers any method with
    // itself rather than listing the ones each component happens to use.
    FadeIn: builder(),
    FadeOut: builder(),
    FadeInDown: builder(),
    FadeInUp: builder(),
    FadeOutDown: builder(),
    ZoomIn: builder(),
    ZoomOut: builder(),
    SlideInDown: builder(),
    SlideOutDown: builder(),
    LinearTransition: builder(),
    CurvedTransition: builder(),
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  };
});

// Gesture handler needs its native module stubbed before anything renders a
// GestureHandlerRootView (every sheet does).
require('react-native-gesture-handler/jestSetup');

// Safe area insets: the library's own mock, so screens and sheets render
// outside a provider.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Skia draws only on a device build; tests take the still-picture path (lib/skiaReady.ts).
jest.mock('@/lib/skiaReady', () => ({ skiaReady: false }));
