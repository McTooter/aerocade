import SwiftUI

extension Color {
    init(hex: String) {
        var hexString = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if hexString.hasPrefix("#") {
            hexString.removeFirst()
        }
        
        var rgb: UInt64 = 0
        Scanner(string: hexString).scanHexInt64(&rgb)
        
        let r = Double((rgb >> 16) & 0xFF) / 255.0
        let g = Double((rgb >> 8) & 0xFF) / 255.0
        let b = Double(rgb & 0xFF) / 255.0
        
        self.init(red: r, green: g, blue: b)
    }
    
    func toHex() -> String {
        let uiColor = UIColor(self)
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        uiColor.getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02X%02X%02X", Int(r * 255), Int(g * 255), Int(b * 255))
    }
}

final class ThemeManager: ObservableObject {
    static let shared = ThemeManager()
    
    @Published var configuration: ThemeConfiguration = ThemeConfiguration(name: "Default", isCustom: false)
    @Published var accentHue: Double = 0.6
    @Published var accentSaturation: Double = 0.8
    @Published var accentBrightness: Double = 0.8
    @Published var isBlurEnabled: Bool = true
    
    private init() {}
    
    func apply(_ theme: ThemeConfiguration) {
        configuration = theme
    }
    
    var primaryColor: Color {
        Color(hex: configuration.primaryColor)
    }
    
    var secondaryColor: Color {
        Color(hex: configuration.secondaryColor)
    }
    
    var backgroundColor: Color {
        Color(hex: configuration.backgroundColor)
    }
    
    var surfaceColor: Color {
        Color(hex: configuration.surfaceColor)
    }
    
    var accentColor: Color {
        Color(hex: configuration.accentColor)
    }
    
    var textPrimaryColor: Color {
        Color(hex: configuration.textPrimaryColor)
    }
    
    var textSecondaryColor: Color {
        Color(hex: configuration.textSecondaryColor)
    }
    
    var cornerRadius: CGFloat {
        CGFloat(configuration.cornerRadius)
    }
    
    var blurIntensity: CGFloat {
        CGFloat(configuration.blurIntensity)
    }
    
    var font: Font {
        switch configuration.fontName {
        case "SF Pro":
            return .system(size: 17)
        case "Rounded":
            return .system(size: 17, design: .rounded)
        case "Serif":
            return .system(size: 17, design: .serif)
        case "Monospaced":
            return .system(size: 17, design: .monospaced)
        default:
            return .system(size: 17)
        }
    }
    
    var fontBold: Font {
        switch configuration.fontName {
        case "SF Pro":
            return .system(size: 17, weight: .bold)
        case "Rounded":
            return .system(size: 17, weight: .bold, design: .rounded)
        case "Serif":
            return .system(size: 17, weight: .bold, design: .serif)
        case "Monospaced":
            return .system(size: 17, weight: .bold, design: .monospaced)
        default:
            return .system(size: 17, weight: .bold)
        }
    }
    
    func font(size: CGFloat) -> Font {
        let multiplier = CGFloat(configuration.fontSizeMultiplier)
        switch configuration.fontName {
        case "SF Pro":
            return .system(size: size * multiplier)
        case "Rounded":
            return .system(size: size * multiplier, design: .rounded)
        case "Serif":
            return .system(size: size * multiplier, design: .serif)
        case "Monospaced":
            return .system(size: size * multiplier, design: .monospaced)
        default:
            return .system(size: size * multiplier)
        }
    }
    
    func fontBold(size: CGFloat) -> Font {
        let multiplier = CGFloat(configuration.fontSizeMultiplier)
        switch configuration.fontName {
        case "SF Pro":
            return .system(size: size * multiplier, weight: .bold)
        case "Rounded":
            return .system(size: size * multiplier, weight: .bold, design: .rounded)
        case "Serif":
            return .system(size: size * multiplier, weight: .bold, design: .serif)
        case "Monospaced":
            return .system(size: size * multiplier, weight: .bold, design: .monospaced)
        default:
            return .system(size: size * multiplier, weight: .bold)
        }
    }
    
    func font(size: CGFloat, weight: Font.Weight) -> Font {
        let multiplier = CGFloat(configuration.fontSizeMultiplier)
        switch configuration.fontName {
        case "SF Pro":
            return .system(size: size * multiplier, weight: weight)
        case "Rounded":
            return .system(size: size * multiplier, weight: weight, design: .rounded)
        case "Serif":
            return .system(size: size * multiplier, weight: weight, design: .serif)
        case "Monospaced":
            return .system(size: size * multiplier, weight: weight, design: .monospaced)
        default:
            return .system(size: size * multiplier, weight: weight)
        }
    }
    
    func resetToDefault() {
        configuration = ThemeConfiguration(name: "Default", isCustom: false)
    }
    
    var dynamicBackground: Color {
        if isBlurEnabled {
            return backgroundColor.opacity(0.8)
        }
        return backgroundColor
    }
    
    var cardBackground: LinearGradient {
        LinearGradient(
            colors: [surfaceColor, surfaceColor.opacity(0.8)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

struct ThemeModifier: ViewModifier {
    @ObservedObject var themeManager: ThemeManager
    
    func body(content: Content) -> some View {
        content
            .tint(themeManager.accentColor)
            .foregroundColor(themeManager.textPrimaryColor)
            .background(themeManager.backgroundColor.ignoresSafeArea())
            .preferredColorScheme(themeManager.configuration.colorScheme.colorScheme)
    }
}

extension View {
    func themed(_ themeManager: ThemeManager = .shared) -> some View {
        modifier(ThemeModifier(themeManager: themeManager))
    }
}

struct ThemePicker: View {
    @ObservedObject var themeManager: ThemeManager
    @Environment(\.dismiss) private var dismiss
    
    private let presetThemes: [ThemeConfiguration] = [
        ThemeConfiguration(name: "Midnight", isCustom: false).apply { theme in
            theme.primaryColor = "#1DB954"
            theme.secondaryColor = "#191414"
            theme.backgroundColor = "#000000"
            theme.surfaceColor = "#121212"
            theme.accentColor = "#1DB954"
        },
        ThemeConfiguration(name: "Ocean", isCustom: false).apply { theme in
            theme.primaryColor = "#00B4D8"
            theme.secondaryColor = "#0077B6"
            theme.backgroundColor = "#03045E"
            theme.surfaceColor = "#023E8A"
            theme.accentColor = "#48CAE4"
        },
        ThemeConfiguration(name: "Sunset", isCustom: false).apply { theme in
            theme.primaryColor = "#FF6B6B"
            theme.secondaryColor = "#FF8E53"
            theme.backgroundColor = "#2D1B69"
            theme.surfaceColor = "#3D2B7A"
            theme.accentColor = "#FF6B6B"
        },
        ThemeConfiguration(name: "Forest", isCustom: false).apply { theme in
            theme.primaryColor = "#2ECC71"
            theme.secondaryColor = "#27AE60"
            theme.backgroundColor = "#0B3D2E"
            theme.surfaceColor = "#145A41"
            theme.accentColor = "#2ECC71"
        },
        ThemeConfiguration(name: "Cyber", isCustom: false).apply { theme in
            theme.primaryColor = "#00FF9F"
            theme.secondaryColor = "#00B8D9"
            theme.backgroundColor = "#0A0A0F"
            theme.surfaceColor = "#131320"
            theme.accentColor = "#00FF9F"
        },
        ThemeConfiguration(name: "Royal", isCustom: false).apply { theme in
            theme.primaryColor = "#9B59B6"
            theme.secondaryColor = "#8E44AD"
            theme.backgroundColor = "#1A1A2E"
            theme.surfaceColor = "#2B2B4A"
            theme.accentColor = "#9B59B6"
        }
    ]
    
    var body: some View {
        NavigationStack {
            List {
                Section("Preset Themes") {
                    ForEach(presetThemes, id: \.id) { theme in
                        Button {
                            themeManager.apply(theme)
                            dismiss()
                        } label: {
                            HStack {
                                Circle()
                                    .fill(Color(hex: theme.primaryColor))
                                    .frame(width: 24, height: 24)
                                Circle()
                                    .fill(Color(hex: theme.accentColor))
                                    .frame(width: 24, height: 24)
                                Circle()
                                    .fill(Color(hex: theme.backgroundColor))
                                    .frame(width: 24, height: 24)
                                VStack(alignment: .leading) {
                                    Text(theme.name)
                                        .font(.headline)
                                    Text("Preset")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                Spacer()
                                if themeManager.configuration.name == theme.name {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(themeManager.accentColor)
                                }
                            }
                        }
                    }
                }
                
                Section("Customize") {
                    NavigationLink {
                        ThemeCustomizerView(themeManager: themeManager)
                    } label: {
                        Label("Create Custom Theme", systemImage: "paintpalette")
                    }
                }
            }
            .navigationTitle("Theme Picker")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

extension ThemeConfiguration {
    func apply(_ mutate: (ThemeConfiguration) -> Void) -> ThemeConfiguration {
        mutate(self)
        return self
    }
}

struct ThemeCustomizerView: View {
    @ObservedObject var themeManager: ThemeManager
    @Environment(\.dismiss) private var dismiss
    @State private var themeName = "My Theme"
    @State private var primaryColor = Color.blue
    @State private var secondaryColor = Color.purple
    @State private var backgroundColor = Color.black
    @State private var surfaceColor = Color(hex: "#1C1C1E")
    @State private var accentColor = Color.red
    @State private var textPrimaryColor = Color.white
    @State private var textSecondaryColor = Color.gray
    @State private var cornerRadius: CGFloat = 12
    @State private var blurIntensity: CGFloat = 20
    @State private var fontSizeMultiplier: CGFloat = 1.0
    @State private var selectedFont = "SF Pro"
    @State private var selectedColorScheme: ColorSchemeOption = .dark
    
    let fontOptions = ["SF Pro", "Rounded", "Serif", "Monospaced"]
    
    var body: some View {
        Form {
            Section("Theme Name") {
                TextField("Theme Name", text: $themeName)
            }
            
            Section("Colors") {
                ColorPicker("Primary", selection: $primaryColor)
                ColorPicker("Secondary", selection: $secondaryColor)
                ColorPicker("Background", selection: $backgroundColor)
                ColorPicker("Surface", selection: $surfaceColor)
                ColorPicker("Accent", selection: $accentColor)
                ColorPicker("Text Primary", selection: $textPrimaryColor)
                ColorPicker("Text Secondary", selection: $textSecondaryColor)
            }
            
            Section("Typography") {
                Picker("Font", selection: $selectedFont) {
                    ForEach(fontOptions, id: \.self) { font in
                        Text(font).tag(font)
                    }
                }
                HStack {
                    Text("Font Size: \(fontSizeMultiplier, specifier: "%.1f")x")
                    Slider(value: $fontSizeMultiplier, in: 0.8...1.5, step: 0.1)
                }
            }
            
            Section("Layout") {
                HStack {
                    Text("Corner Radius: \(Int(cornerRadius))")
                    Slider(value: $cornerRadius, in: 0...30)
                }
                HStack {
                    Text("Blur Intensity: \(Int(blurIntensity))")
                    Slider(value: $blurIntensity, in: 0...40)
                }
            }
            
            Section("Appearance") {
                Picker("Color Scheme", selection: $selectedColorScheme) {
                    ForEach(ColorSchemeOption.allCases, id: \.self) { scheme in
                        Text(scheme.rawValue.capitalized).tag(scheme)
                    }
                }
            }
            
            Section {
                Button("Save Theme") {
                    let theme = ThemeConfiguration(name: themeName)
                    theme.primaryColor = primaryColor.toHex()
                    theme.secondaryColor = secondaryColor.toHex()
                    theme.backgroundColor = backgroundColor.toHex()
                    theme.surfaceColor = surfaceColor.toHex()
                    theme.accentColor = accentColor.toHex()
                    theme.textPrimaryColor = textPrimaryColor.toHex()
                    theme.textSecondaryColor = textSecondaryColor.toHex()
                    theme.cornerRadius = Float(cornerRadius)
                    theme.blurIntensity = Float(blurIntensity)
                    theme.fontSizeMultiplier = Float(fontSizeMultiplier)
                    theme.fontName = selectedFont
                    theme.colorScheme = selectedColorScheme
                    
                    themeManager.apply(theme)
                    if let profile = DatabaseManager.shared.activeProfile {
                        DatabaseManager.shared.saveTheme(theme, for: profile)
                    }
                    dismiss()
                }
                .frame(maxWidth: .infinity)
                .buttonStyle(.borderedProminent)
                .tint(accentColor)
            }
        }
        .navigationTitle("Customize Theme")
    }
}