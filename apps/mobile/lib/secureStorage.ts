import * as SecureStore from 'expo-secure-store';

export const SecureTokenService = {
  /**
   * Stores a token securely.
   * @param serviceName The name of the service (e.g., 'strava', 'spotify').
   * @param type The type of token ('access' or 'refresh').
   * @param token The token string.
   */
  async saveToken(serviceName: string, type: 'access' | 'refresh', token: string): Promise<void> {
    const key = `habyss_${serviceName}_${type}_token`;
    await SecureStore.setItemAsync(key, token);
  },

  /**
   * Retrieves a securely stored token.
   * @param serviceName The name of the service.
   * @param type The type of token.
   */
  async getToken(serviceName: string, type: 'access' | 'refresh'): Promise<string | null> {
    const key = `habyss_${serviceName}_${type}_token`;
    return await SecureStore.getItemAsync(key);
  },

  /**
   * Deletes a securely stored token.
   * @param serviceName The name of the service.
   * @param type The type of token.
   */
  async deleteToken(serviceName: string, type: 'access' | 'refresh'): Promise<void> {
    const key = `habyss_${serviceName}_${type}_token`;
    await SecureStore.deleteItemAsync(key);
  },

  /**
   * Clears all tokens for a service.
   * @param serviceName The name of the service.
   */
  async clearServiceTokens(serviceName: string): Promise<void> {
    await Promise.all([
      this.deleteToken(serviceName, 'access'),
      this.deleteToken(serviceName, 'refresh')
    ]);
  }
};
