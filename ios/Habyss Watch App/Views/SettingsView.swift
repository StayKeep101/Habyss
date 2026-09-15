import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var session: WatchSessionManager
    
    @AppStorage("watchNotificationsEnabled") var notificationsEnabled = true
    @AppStorage("watchHapticsEnabled") var hapticsEnabled = true
    @AppStorage("watchReminderLeadTime") var reminderLeadMinutes = 15
    @AppStorage("watchComplicationStyle") var complicationStyle = "progress"
    
    var body: some View {
        List {
            Section("Notifications") {
                Toggle("Habit Reminders", isOn: $notificationsEnabled)
                
                Picker("Lead Time", selection: $reminderLeadMinutes) {
                    Text("5 min").tag(5)
                    Text("15 min").tag(15)
                    Text("30 min").tag(30)
                    Text("1 hour").tag(60)
                }
            }
            
            Section("Haptics") {
                Toggle("Haptic Feedback", isOn: $hapticsEnabled)
            }
            
            Section("Complication") {
                Picker("Style", selection: $complicationStyle) {
                    Text("Progress Ring").tag("progress")
                    Text("Streak Count").tag("streak")
                    Text("Next Habit").tag("next")
                }
            }
            
            Section("Sync") {
                Button("Sync with iPhone") {
                    session.requestFullSync()
                }
                .foregroundColor(.habyssBlue)
                
                Button("Clear Watch Cache") {
                    UserDefaults.standard.removeObject(forKey: HabyssConstants.cachedHabitsKey)
                    UserDefaults.standard.removeObject(forKey: HabyssConstants.habitCacheDateKey)
                    session.habits = []
                }
                .foregroundColor(.habyssRose)
            }
            
            Section("Mindfulness") {
                NavigationLink(destination: BreathingView()) {
                    Label("Breathing Exercise", systemImage: "wind")
                }
            }
            
            Section("About") {
                LabeledContent("Version", value: "1.0.0")
                LabeledContent("Last Sync", value: session.lastSyncString)
            }
        }
        .navigationTitle("Settings")
    }
}
