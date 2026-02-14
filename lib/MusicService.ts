import { NativeModules, Platform } from 'react-native';

const { MusicModule } = NativeModules;

export interface MusicServiceType {
    requestAuthorization: () => Promise<boolean>;
    isAuthorized: () => Promise<boolean>;
    getPlaylists: () => Promise<any[]>;
    playPlaylist: (playlistId: string) => Promise<boolean>;
    stop: () => Promise<boolean>;
}

// Fallback for Android/Simulator or if module missing
const MockMusicService: MusicServiceType = {
    requestAuthorization: async () => false,
    isAuthorized: async () => false,
    getPlaylists: async () => [],
    playPlaylist: async () => { console.warn('MusicModule not available'); return false; },
    stop: async () => { return false; },
};

export const MusicService: MusicServiceType = (Platform.OS === 'ios' && MusicModule)
    ? MusicModule
    : MockMusicService;
