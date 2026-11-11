import ManagedSettings
import ManagedSettingsUI
import UIKit

/// The screen iOS shows over a blocked app. Apple draws it; Habyss gives it its
/// look: the app's near-black, the Habyss mark, Echo's line in your chosen voice,
/// and today's top 3 with the done ones ticked (written by the app, lib/appGate.ts
/// shieldWords). The buttons' jobs are in ShieldActionExtension.
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
        let title = state?.notice ?? (fresh ? state?.title : nil) ?? "Finish your top 3 first"
        let subtitle = (fresh ? state?.lines?.joined(separator: "\n") : nil)
            ?? "Open Habyss to see today's top 3.\n\n100 Shards opens them for an hour."
        return ShieldConfiguration(
            // The darkest blur under a near-black: with no blur, iOS draws its own light material and ignores the colour.
            backgroundBlurStyle: .dark,
            backgroundColor: background,
            icon: UIImage(named: "HabyssMark") ?? UIImage(systemName: "lock.fill")?.withTintColor(accent, renderingMode: .alwaysOriginal),
            title: .init(text: title, color: .white),
            subtitle: .init(text: subtitle, color: muted),
            primaryButtonLabel: .init(text: "Use 100 Shards", color: .white),
            primaryButtonBackgroundColor: accent,
            secondaryButtonLabel: .init(text: "Not now", color: UIColor(white: 0.92, alpha: 1))
        )
    }
}
