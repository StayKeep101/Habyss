import Foundation
import React
import WidgetKit

@objc(SharedDefaults)
class SharedDefaults: NSObject {
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }

  private let appGroup = "group.com.habyss.data"
  
  @objc
  func set(_ key: String, value: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    // Publish the dashboard atomically before asking WidgetKit to reload.
    // A file avoids cross-process UserDefaults cache delays on the Home Screen.
    if key == "widgetDashboard" {
      guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
        reject("APP_GROUP_ERROR", "The Habyss App Group is missing from this signed build", nil)
        return
      }
      do {
        try Data(value.utf8).write(to: container.appendingPathComponent("widgetDashboard.json"), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
      } catch {
        reject("WIDGET_WRITE_ERROR", "Could not publish the widget snapshot", error)
        return
      }
    }
    if let userDefaults = UserDefaults(suiteName: appGroup) {
      userDefaults.set(value, forKey: key)
      resolve(true)
    } else {
      reject("USER_DEFAULTS_ERROR", "Could not initialize UserDefaults with suiteName \(appGroup)", nil)
    }
  }
  
  @objc
  func get(_ key: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    if let userDefaults = UserDefaults(suiteName: appGroup) {
      let value = userDefaults.string(forKey: key)
      resolve(value)
    } else {
      reject("USER_DEFAULTS_ERROR", "Could not initialize UserDefaults with suiteName \(appGroup)", nil)
    }
  }

  @objc
  func getInteger(_ key: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    if let userDefaults = UserDefaults(suiteName: appGroup) {
      let value = userDefaults.integer(forKey: key)
      resolve(value)
    } else {
      reject("USER_DEFAULTS_ERROR", "Could not initialize UserDefaults", nil)
    }
  }

  @objc
  func getDouble(_ key: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    if let userDefaults = UserDefaults(suiteName: appGroup) {
      let value = userDefaults.double(forKey: key)
      resolve(value)
    } else {
      reject("USER_DEFAULTS_ERROR", "Could not initialize UserDefaults", nil)
    }
  }

  @objc
  func getArray(_ key: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    if let userDefaults = UserDefaults(suiteName: appGroup) {
      let value = userDefaults.array(forKey: key)
      resolve(value)
    } else {
      reject("USER_DEFAULTS_ERROR", "Could not initialize UserDefaults", nil)
    }
  }

  @objc
  func getPendingWidgetEvents(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    guard let defaults = UserDefaults(suiteName: appGroup) else {
      reject("USER_DEFAULTS_ERROR", "Could not initialize shared storage", nil)
      return
    }
    var events = defaults.dictionaryRepresentation().filter { $0.key.hasPrefix("widget_event_") }
      .compactMap { $0.value as? String }
    if let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) {
      let inbox = container.appendingPathComponent("widget-events", isDirectory: true)
      let files = (try? FileManager.default.contentsOfDirectory(at: inbox, includingPropertiesForKeys: nil)) ?? []
      events += files.filter { $0.pathExtension == "json" }.compactMap { try? String(contentsOf: $0, encoding: .utf8) }
    }
    resolve(events)
  }

  @objc
  func remove(_ key: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    if key.hasPrefix("widget_event_"),
       let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) {
      let id = String(key.dropFirst("widget_event_".count))
      guard !id.contains("/"), !id.contains("..") else { reject("WIDGET_EVENT_ERROR", "Invalid widget event ID", nil); return }
      let file = container.appendingPathComponent("widget-events").appendingPathComponent(id + ".json")
      do {
        if FileManager.default.fileExists(atPath: file.path) { try FileManager.default.removeItem(at: file) }
      } catch { reject("WIDGET_EVENT_ERROR", "Could not acknowledge widget action", error); return }
    }
    if key == "widgetDashboard",
       let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) {
      let file = container.appendingPathComponent("widgetDashboard.json")
      do {
        // A tombstone prevents another process's cached legacy defaults from
        // resurfacing the previous account's snapshot after logout.
        try Data("{}".utf8).write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
      } catch {
        reject("WIDGET_REMOVE_ERROR", "Could not clear the widget snapshot", error)
        return
      }
    }
    if let userDefaults = UserDefaults(suiteName: appGroup) {
      userDefaults.removeObject(forKey: key)
      resolve(true)
    } else {
      reject("USER_DEFAULTS_ERROR", "Could not initialize UserDefaults", nil)
    }
  }

  @objc
  func saveImage(_ base64: String, fileName: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    guard let userDefaults = UserDefaults(suiteName: appGroup) else {
      reject("USER_DEFAULTS_ERROR", "Could not initialize UserDefaults with suiteName \(appGroup)", nil)
      return
    }
    
    guard let data = Data(base64Encoded: base64) else {
      reject("IMAGE_ERROR", "Could not decode base64 string", nil)
      return
    }
    
    guard let containerUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
      reject("FILE_ERROR", "Could not access App Group container", nil)
      return
    }
    
    let fileUrl = containerUrl.appendingPathComponent(fileName)
    
    do {
      try data.write(to: fileUrl)
      // Save the file path in UserDefaults for easy access if needed, though we return it
      userDefaults.set(fileUrl.path, forKey: fileName)
      resolve(fileUrl.path)
    } catch {
      reject("SAVE_ERROR", "Could not save image to file: \(error.localizedDescription)", error)
    }
  }
  @objc
  func reloadTimelines(_ resolver: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
      resolver(true)
    } else {
      resolver(false)
    }
  }
}
