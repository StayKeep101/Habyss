import ManagedSettings
import ManagedSettingsUI
import UIKit

/// The screen iOS shows over a blocked app: the Focus Gate, drawn as close to the
/// app's own page (app/(root)/unlock.tsx) as Apple allows: the Habyss mark,
/// "Earn your scroll", today's top 3 as a list with the done ones ticked and the
/// count (written by the app, lib/appGate.ts shieldWords), "Work on priorities"
/// in the accent and the Shards hour under it. The buttons' jobs are in ShieldActionExtension.
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
        let title = state?.notice ?? (fresh ? state?.title : nil) ?? "Earn your scroll"
        let subtitle = (fresh ? state?.lines?.joined(separator: "\n") : nil)
            ?? "Complete your priorities or redeem Shards.\n\nOpen Habyss to see today's top 3."
        let planning = fresh && state?.planned == 0
        return ShieldConfiguration(
            // The darkest blur under a near-black: with no blur, iOS draws its own light material and ignores the colour.
            backgroundBlurStyle: .dark,
            backgroundColor: background,
            icon: UIImage(named: "HabyssMark") ?? UIImage(systemName: "lock.fill")?.withTintColor(accent, renderingMode: .alwaysOriginal),
            title: .init(text: title, color: .white),
            subtitle: .init(text: subtitle, color: muted),
            primaryButtonLabel: .init(text: planning ? "Plan your day" : "Work on priorities", color: .white),
            primaryButtonBackgroundColor: accent,
            secondaryButtonLabel: .init(text: "100 Shards · Unlock 1 hour", color: accent)
        )
    }
}
