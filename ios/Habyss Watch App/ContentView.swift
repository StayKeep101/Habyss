import SwiftUI

struct ContentView: View {
    @EnvironmentObject var sessionManager: WatchSessionManager
    @State private var selectedTab = 0
    @State private var animateBg = false
    
    var body: some View {
        ZStack {
            // Animated Void Background
            LinearGradient(colors: [
                Color(red: 0.1, green: 0, blue: 0.2),
                Color.black,
                Color(red: 0, green: 0.1, blue: 0.2)
            ], startPoint: animateBg ? .topLeading : .bottomTrailing,
               endPoint: animateBg ? .bottomTrailing : .topLeading)
            .ignoresSafeArea()
            .animation(.easeInOut(duration: 10).repeatForever(autoreverses: true), value: animateBg)
            .onAppear { animateBg = true }
            
            TabView(selection: $selectedTab) {
                // Tab 1: Dashboard (Glance)
                NavigationStack {
                    DashboardView()
                }
                .tag(0)
                
                // Tab 2: Habits List
                NavigationStack {
                    HabitListView()
                }
                .tag(1)
                
                // Tab 3: Focus Timer
                NavigationStack {
                    FocusTimerView()
                }
                .tag(2)
                
                // Tab 4: Progress Rings
                NavigationStack {
                    ProgressRingsView()
                }
                .tag(3)
                
                // Tab 5: Settings
                NavigationStack {
                    SettingsView()
                }
                .tag(4)
            }
            .tabViewStyle(.verticalPage)
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(WatchSessionManager.shared)
}
