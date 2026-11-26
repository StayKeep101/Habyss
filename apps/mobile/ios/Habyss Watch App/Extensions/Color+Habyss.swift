import SwiftUI

extension Color {
    // MARK: - Habyss Colors
    // The accent follows the theme chosen on the phone, sent with each update
    // (the middle of its gradient, the same colour the app fills chips with).
    // The fixed blue the watch used to draw with matched no theme.
    static var habyssAccent: Color { Color(hex: UserDefaults.standard.string(forKey: "watchAccent") ?? "#5B7FD6") }
    static var habyssAccentFrom: Color { Color(hex: UserDefaults.standard.string(forKey: "watchAccentFrom") ?? "#3A5A8C") }
    static var habyssAccentTo: Color { Color(hex: UserDefaults.standard.string(forKey: "watchAccentTo") ?? "#8BADD6") }
    static var habyssBlue: Color { habyssAccent }
    static var habyssIndigo: Color { habyssAccentTo }
    static var habyssViolet: Color { habyssAccentFrom }
    static let habyssGreen  = Color(hex: "#10B981")
    static let habyssAmber  = Color(hex: "#F59E0B")
    static let habyssRose   = Color(hex: "#F43F5E")
    
    // MARK: - Hex Initializer
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
