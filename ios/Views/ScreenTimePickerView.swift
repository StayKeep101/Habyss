import SwiftUI
import FamilyControls

/// The apps to block. `allowRemoval` false (the usual case): adding is saved at
/// once, and anything taken off the list is put back, since removing waits a
/// day (lib/gateLock.ts). `onClose` says what happened: "saved", "held"
/// (something was taken off and kept), or "cancelled".
@available(iOS 16.0, *)
struct ScreenTimePickerView: View {
    @ObservedObject var manager = ScreenTimeManager.shared
    @Environment(\.dismiss) var dismiss
    var allowRemoval = true
    var onClose: ((String) -> Void)? = nil
    @State private var before = FamilyActivitySelection()
    @State private var answered = false

    var body: some View {
        NavigationView {
            FamilyActivityPicker(selection: $manager.activitySelection)
                .navigationTitle("Block Apps")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            answer(save())
                            dismiss()
                        }
                    }
                }
        }
        .onAppear {
            manager.loadSelection()
            before = manager.activitySelection
        }
        .onDisappear {
            // Swiped away: nothing saved, the list stays as it was.
            if !answered { manager.loadSelection(); answer("cancelled") }
        }
    }

    private func answer(_ result: String) {
        guard !answered else { return }
        answered = true
        onClose?(result)
    }

    /// Saves what was picked, keeping anything taken off unless removing is open.
    private func save() -> String {
        let picked = manager.activitySelection
        let removed = !before.applicationTokens.isSubset(of: picked.applicationTokens)
            || !before.categoryTokens.isSubset(of: picked.categoryTokens)
            || !before.webDomainTokens.isSubset(of: picked.webDomainTokens)
        guard removed && !allowRemoval else {
            manager.saveSelection()
            return "saved"
        }
        var kept = picked
        kept.applicationTokens.formUnion(before.applicationTokens)
        kept.categoryTokens.formUnion(before.categoryTokens)
        kept.webDomainTokens.formUnion(before.webDomainTokens)
        manager.activitySelection = kept
        manager.saveSelection()
        return "held"
    }
}
