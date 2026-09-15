import Foundation
import FamilyControls
import ManagedSettings
import SwiftUI

@available(iOS 16.0, *)
class ScreenTimeManager: ObservableObject {
    static let shared = ScreenTimeManager()
    
    private let store = ManagedSettingsStore()
    private let appGroupId = "group.com.habyss.data"
    @Published var activitySelection = FamilyActivitySelection()
    
    private init() {
        loadSelection()
    }
    
    func requestAuthorization() async {
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            print("Screen Time Authorization Granted")
        } catch {
            print("Screen Time Authorization Failed: \(error)")
        }
    }
    
    func setShieldEnabled(_ enabled: Bool) {
        if enabled {
            // Reload saved selection to make sure we have latest
            loadSelection()
            
            // Apply shields to selected apps and categories
            store.shield.applications = activitySelection.applicationTokens
            store.shield.applicationCategories = ShieldSettings.ActivityCategoryPolicy.specific(activitySelection.categoryTokens)
            store.shield.webDomainCategories = ShieldSettings.ActivityCategoryPolicy.specific(activitySelection.categoryTokens)
            print("Screen Time shields ENABLED for \(activitySelection.applicationTokens.count) apps")
        } else {
            // Clear all shields
            store.shield.applications = nil
            store.shield.applicationCategories = nil
            store.shield.webDomainCategories = nil
            print("Screen Time shields DISABLED")
        }
    }
    
    func saveSelection() {
        guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
        if let data = try? JSONEncoder().encode(activitySelection) {
            defaults.set(data, forKey: "ScreenTimeSelection")
            print("Screen Time selection saved (\(activitySelection.applicationTokens.count) apps)")
        }
    }
    
    func loadSelection() {
        guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
        if let data = defaults.data(forKey: "ScreenTimeSelection"),
           let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) {
            self.activitySelection = selection
            print("Screen Time selection loaded (\(selection.applicationTokens.count) apps)")
        }
    }
}
