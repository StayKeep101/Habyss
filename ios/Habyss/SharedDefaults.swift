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
  func remove(_ key: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
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
