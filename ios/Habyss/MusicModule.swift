import Foundation
import MusicKit

@objc(MusicModule)
class MusicModule: NSObject {
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc
  func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    Task {
      let status = await MusicAuthorization.request()
      switch status {
      case .authorized:
        resolve(true)
      case .denied, .restricted:
        resolve(false)
      case .notDetermined:
        resolve(false)
      @unknown default:
        resolve(false)
      }
    }
  }

  @objc
  func isAuthorized(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
     let status = MusicAuthorization.currentStatus
     resolve(status == .authorized)
  }

  @objc
  func playPlaylist(_ playlistId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    Task {
      do {
        let request = MusicCatalogResourceRequest<Playlist>(matching: \.id, equalTo: MusicItemID(playlistId))
        let response = try await request.response()
        
        guard let playlist = response.items.first else {
          reject("NOT_FOUND", "Playlist not found", nil)
          return
        }
        
        let player = ApplicationMusicPlayer.shared
        player.queue = [playlist]
        try await player.play()
        resolve(true)
      } catch {
        reject("PLAY_ERROR", "Failed to play: \(error.localizedDescription)", error)
      }
    }
  }

  @objc
  func getPlaylists(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    Task {
      do {
        // Fetch playlists from library
        var request = MusicLibraryRequest<Playlist>()
        request.limit = 20
        let response = try await request.response()
        
        let playlists = response.items.map { playlist in
          return [
            "id": playlist.id.rawValue,
            "name": playlist.name,
            "artwork": playlist.artwork?.url(width: 100, height: 100)?.absoluteString ?? ""
          ]
        }
        resolve(playlists)
      } catch {
        // Fallback for simulator or no permission
        print("Music fetch error: \(error)")
        resolve([]) 
      }
    }
  }

  @objc
  func stop(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    ApplicationMusicPlayer.shared.stop()
    resolve(true)
  }
}
