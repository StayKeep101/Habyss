import SwiftUI
import FamilyControls

@available(iOS 16.0, *)
struct ScreenTimePickerView: View {
    @ObservedObject var manager = ScreenTimeManager.shared
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            VStack {
                if #available(iOS 16.0, *) {
                    FamilyActivityPicker(selection: $manager.activitySelection)
                } else {
                    Text("Screen Time requires iOS 16+")
                }
            }
            .navigationTitle("Block Apps")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        manager.saveSelection()
                        dismiss()
                    }
                }
            }
        }
    }
}
