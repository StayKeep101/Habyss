/**
 * Spotify Service for Habyss
 * 
 * Provides OAuth authentication and playlist/track linking for habits.
 * Opens music in the Spotify app (works with or without Spotify Premium).
 * 
 * SETUP: Add your Spotify Client ID to .env:
 * EXPO_PUBLIC_SPOTIFY_CLIENT_ID=your_client_id_here
 * 
 * Create an app at: https://developer.spotify.com/dashboard
 */

import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IntegrationService } from './integrationService';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const REDIRECT_URI = Linking.createURL('spotify-callback');
const SCOPES = [
    'user-read-playback-state',
    'user-read-currently-playing',
    'playlist-read-private',
    'playlist-read-collaborative',
].join('%20');

export interface SpotifyPlaylist {
    id: string;
    name: string;
    imageUrl: string | null;
    trackCount: number;
    uri: string;
}

export interface SpotifyTrack {
    id: string;
    name: string;
    artist: string;
    albumArt: string | null;
    uri: string;
    durationMs: number;
}

export const SpotifyService = {
    /**
     * Check if Spotify is connected
     */
    async isConnected(): Promise<boolean> {
        const token = await AsyncStorage.getItem('spotify_access_token');
        return !!token;
    },

    /**
     * Get the stored access token
     */
    async getAccessToken(): Promise<string | null> {
        return AsyncStorage.getItem('spotify_access_token');
    },

    /**
     * Initiate OAuth flow
     */
    async connect(): Promise<void> {
        const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
        if (!clientId) {
            throw new Error('Spotify Client ID not configured');
        }

        const authUrl = `${SPOTIFY_AUTH_URL}?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${SCOPES}`;

        // Open Spotify auth in browser
        await Linking.openURL(authUrl);
    },

    /**
     * Handle the OAuth callback and store tokens
     */
    async handleCallback(url: string): Promise<boolean> {
        try {
            // Extract access token from URL fragment
            const hashParams = url.split('#')[1];
            if (!hashParams) return false;

            const params = new URLSearchParams(hashParams);
            const accessToken = params.get('access_token');
            const expiresIn = params.get('expires_in');

            if (!accessToken) return false;

            // Store token
            await AsyncStorage.setItem('spotify_access_token', accessToken);

            // Calculate expiry
            const expiry = new Date();
            expiry.setSeconds(expiry.getSeconds() + parseInt(expiresIn || '3600'));
            await AsyncStorage.setItem('spotify_token_expiry', expiry.toISOString());

            // Update integration status
            await IntegrationService.connectService('spotify', {
                accessToken,
                expiry,
            });

            return true;
        } catch (error) {
            console.error('Spotify callback error:', error);
            return false;
        }
    },

    /**
     * Disconnect Spotify
     */
    async disconnect(): Promise<void> {
        await AsyncStorage.removeItem('spotify_access_token');
        await AsyncStorage.removeItem('spotify_token_expiry');
        await IntegrationService.disconnectService('spotify');
    },

    /**
     * Get user's playlists
     */
    async getPlaylists(): Promise<SpotifyPlaylist[]> {
        const token = await this.getAccessToken();
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(`${SPOTIFY_API_URL}/me/playlists?limit=50`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch playlists');
        }

        const data = await response.json();
        return data.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            imageUrl: item.images?.[0]?.url || null,
            trackCount: item.tracks?.total || 0,
            uri: item.uri,
        }));
    },

    /**
     * Get a playlist's tracks
     */
    async getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
        const token = await this.getAccessToken();
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(`${SPOTIFY_API_URL}/playlists/${playlistId}/tracks?limit=50`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch tracks');
        }

        const data = await response.json();
        return data.items.map((item: any) => ({
            id: item.track.id,
            name: item.track.name,
            artist: item.track.artists?.[0]?.name || 'Unknown',
            albumArt: item.track.album?.images?.[0]?.url || null,
            uri: item.track.uri,
            durationMs: item.track.duration_ms,
        }));
    },

    /**
     * Open a track or playlist in the Spotify app
     */
    async openInSpotify(uri: string): Promise<void> {
        // Try to open in Spotify app first
        const spotifyUrl = uri.replace('spotify:', 'spotify://');
        const canOpen = await Linking.canOpenURL(spotifyUrl);

        if (canOpen) {
            await Linking.openURL(spotifyUrl);
        } else {
            // Fallback to web player
            const webUrl = uri
                .replace('spotify:playlist:', 'https://open.spotify.com/playlist/')
                .replace('spotify:track:', 'https://open.spotify.com/track/')
                .replace('spotify:album:', 'https://open.spotify.com/album/');
            await Linking.openURL(webUrl);
        }
    },

    /**
     * Save a linked playlist/track for a habit
     */
    async linkToHabit(habitId: string, spotifyUri: string, name: string): Promise<void> {
        await AsyncStorage.setItem(`habit_spotify_${habitId}`, JSON.stringify({
            uri: spotifyUri,
            name,
        }));
    },

    /**
     * Get linked playlist/track for a habit
     */
    async getHabitLink(habitId: string): Promise<{ uri: string; name: string } | null> {
        const data = await AsyncStorage.getItem(`habit_spotify_${habitId}`);
        if (!data) return null;
        return JSON.parse(data);
    },

    /**
     * Remove linked playlist/track for a habit
     */
    async unlinkFromHabit(habitId: string): Promise<void> {
        await AsyncStorage.removeItem(`habit_spotify_${habitId}`);
    },
};
