//
//  HabyssWApp.swift
//  HabyssW Watch App
//
//  Created by erwan on 2026-02-14.
//

import SwiftUI

@main
struct HabyssW_Watch_AppApp: App {
    @StateObject private var session = WatchSessionManager.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(session)
        }
    }
}
