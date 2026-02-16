import { NativeModules, Platform } from 'react-native';

const { SharedDefaults } = NativeModules;

export interface SharedDefaultsType {
    set(key: string, value: string): Promise<boolean>;
    get(key: string): Promise<string | null>;
    getInteger(key: string): Promise<number>;
    getDouble(key: string): Promise<number>;
    getArray(key: string): Promise<any[] | null>;
    remove(key: string): Promise<boolean>;
    saveImage(base64: string, fileName: string): Promise<string>;
    reloadTimelines(): Promise<boolean>;
}

// Mock for non-iOS or Simulator if module missing
const MockSharedDefaults: SharedDefaultsType = {
    set: async () => false,
    get: async () => null,
    getInteger: async () => 0,
    getDouble: async () => 0,
    getArray: async () => [],
    remove: async () => false,
    saveImage: async () => '',
    reloadTimelines: async () => false,
};

export default (Platform.OS === 'ios' && SharedDefaults)
    ? (SharedDefaults as SharedDefaultsType)
    : MockSharedDefaults;
