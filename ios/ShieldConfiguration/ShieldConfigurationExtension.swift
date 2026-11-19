import ManagedSettings
import ManagedSettingsUI
import UIKit

/// The screen iOS shows over a blocked app. Apple allows only an icon, a title, a
/// subtitle and two buttons, so it stays short: the Habyss mark, the title in the
/// app's voice, one line for each fact, and buttons of two or three words. The words
/// come from the app (lib/appGate.ts shieldWords); the buttons' jobs are in ShieldActionExtension.
@available(iOS 16.0, *)
final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    private let background = UIColor(red: 0.02, green: 0.02, blue: 0.03, alpha: 1)
    private let accent = UIColor(red: 0.36, green: 0.46, blue: 1.0, alpha: 1)
    private let muted = UIColor(white: 0.78, alpha: 1)

    override func configuration(shielding application: Application) -> ShieldConfiguration { make() }
    override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration { make() }
    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration { make() }
    override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration { make() }

    private func make() -> ShieldConfiguration {
        // Bedtime: no way through until morning, so no Shards button.
        if Night.active() {
            return ShieldConfiguration(
                backgroundBlurStyle: .dark,
                backgroundColor: background,
                icon: UIImage(named: "HabyssMark") ?? UIImage(systemName: "moon.fill")?.withTintColor(accent, renderingMode: .alwaysOriginal),
                title: .init(text: "The day is done", color: .white),
                subtitle: .init(text: "Your apps sleep until \(Night.wakeText()). So should you.", color: muted),
                primaryButtonLabel: .init(text: "Good night", color: .white),
                primaryButtonBackgroundColor: accent
            )
        }
        let state = Gate.load()
        let fresh = state?.day == Gate.today()
        let title = state?.notice ?? (fresh ? state?.title : nil) ?? "Nice try."
        let subtitle = (fresh ? state?.lines?.joined(separator: "\n") : nil)
            ?? "You blocked this. Good call.\nAn hour costs \(Gate.price) Shards."
        let planning = fresh && state?.planned == 0
        return ShieldConfiguration(
            // The darkest blur under a near-black: with no blur, iOS draws its own light material and ignores the colour.
            backgroundBlurStyle: .dark,
            backgroundColor: background,
            icon: UIImage(named: "HabyssMark") ?? UIImage(systemName: "lock.fill")?.withTintColor(accent, renderingMode: .alwaysOriginal),
            title: .init(text: title, color: .white),
            subtitle: .init(text: subtitle, color: muted),
            // Two or three words each, so iOS never wraps them; white on the grey
            // button (about 12:1; the accent there was 3.3:1).
            primaryButtonLabel: .init(text: planning ? "Plan your day" : (state?.primary ?? "Back to work"), color: .white),
            primaryButtonBackgroundColor: accent,
            secondaryButtonLabel: .init(text: state?.secondary ?? "Unlock 1 hour", color: .white)
        )
    }
}
