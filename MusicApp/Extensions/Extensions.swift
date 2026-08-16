import Foundation
import SwiftUI

extension TimeInterval {
    var minutesAndSeconds: String {
        let minutes = Int(self) / 60
        let seconds = Int(self) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
    
    var hoursAndMinutes: String {
        let hours = Int(self) / 3600
        let minutes = (Int(self) % 3600) / 60
        if hours > 0 {
            return "\(hours) hr \(minutes) min"
        }
        return "\(minutes) min"
    }
}

extension String {
    var isValidEmail: Bool {
        let pattern = #"^[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        return range(of: pattern, options: .regularExpression) != nil
    }
    
    var initials: String {
        let components = split(separator: " ").prefix(2)
        return components.compactMap { $0.first }.map(String.init).joined().uppercased()
    }
}

extension Color {
    static func randomAvatarColor() -> Color {
        let colors: [Color] = [
            .red, .blue, .green, .purple, .orange, .pink, .teal, .yellow
        ]
        return colors.randomElement() ?? .blue
    }
}

extension UIScreen {
    static var screenWidth: CGFloat {
        UIScreen.main.bounds.width
    }
    
    static var screenHeight: CGFloat {
        UIScreen.main.bounds.height
    }
}

extension Bundle {
    var appVersion: String {
        infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    }
    
    var buildNumber: String {
        infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }
}

extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners
    
    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}

extension Array where Element == Track {
    var totalDuration: TimeInterval {
        reduce(0) { $0 + $1.duration }
    }
}

extension Date {
    var timeAgo: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: self, relativeTo: Date())
    }
}