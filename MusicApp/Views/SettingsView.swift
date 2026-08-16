import SwiftUI
import SwiftData

struct SettingsView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @State private var showThemePicker = false
    @State private var showProfileSwitcher = false
    @State private var showProviderConnection = false
    @State private var connectedProviders: Set<MusicProviderType> = []
    
    var body: some View {
        NavigationStack {
            ZStack {
                themeManager.backgroundColor.ignoresSafeArea()
                
                List {
                    profileSection
                    providerSection
                    appearanceSection
                    audioSection
                    playbackSection
                    storageSection
                    aboutSection
                }
                .scrollContentBackground(.hidden)
                .listRowBackground(themeManager.surfaceColor)
                .tint(themeManager.accentColor)
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showThemePicker) {
                ThemePicker(themeManager: themeManager)
            }
            .sheet(isPresented: $showProviderConnection) {
                ProviderConnectionView()
            }
            .sheet(isPresented: $showProfileSwitcher) {
                ProfilePickerView()
            }
        }
        .onAppear {
            loadConnectedProviders()
        }
    }
    
    private var profileSection: some View {
        Section {
            Button {
                showProfileSwitcher = true
            } label: {
                HStack(spacing: 12) {
                    if let profile = DatabaseManager.shared.activeProfile {
                        AvatarView(profile: profile, size: 48)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(profile.name)
                                .font(.headline)
                                .foregroundColor(themeManager.textPrimaryColor)
                            Text("Switch Profile")
                                .font(.caption)
                                .foregroundColor(themeManager.textSecondaryColor)
                        }
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(themeManager.textSecondaryColor)
                }
            }
            
            NavigationLink {
                AccountSettingsView()
            } label: {
                Label("Account", systemImage: "person.crop.circle")
            }
        } header: {
            Text("Profile")
        }
    }
    
    private var providerSection: some View {
        Section {
            Button {
                showProviderConnection = true
            } label: {
                HStack {
                    Label("Music Services", systemImage: "network")
                    Spacer()
                    Text("\(connectedProviders.count) connected")
                        .font(.caption)
                        .foregroundColor(themeManager.textSecondaryColor)
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(themeManager.textSecondaryColor)
                }
            }
        } header: {
            Text("Providers")
        } footer: {
            Text("Connect YouTube Music, Qobuz, Tidal, or your own service to browse and stream from each provider.")
        }
    }
    
    private var appearanceSection: some View {
        Section {
            NavigationLink {
                ThemePicker(themeManager: themeManager)
            } label: {
                HStack {
                    Label("Theme", systemImage: "paintpalette")
                    Spacer()
                    Text(themeManager.configuration.name)
                        .font(.caption)
                        .foregroundColor(themeManager.textSecondaryColor)
                }
            }
        } header: {
            Text("Appearance")
        }
    }
    
    private var audioSection: some View {
        Section {
            audioQualityPicker
        } header: {
            Text("Audio")
        }
    }
    
    private var audioQualityPicker: some View {
        Picker("Audio Quality", selection: audioQualityBinding) {
            ForEach(AudioQuality.allCases, id: \.self) { quality in
                Text(quality.displayName).tag(quality)
            }
        }
    }
    
    private var audioQualityBinding: Binding<AudioQuality> {
        if let prefs = DatabaseManager.shared.activeProfile?.preferences {
            return Binding(
                get: { prefs.audioQuality },
                set: { value in
                    prefs.audioQuality = value
                    try? DatabaseManager.shared.saveContext()
                }
            )
        }
        return .constant(.high)
    }
    
    private var playbackSection: some View {
        Section {
            if let prefs = DatabaseManager.shared.activeProfile?.preferences {
                Toggle("Gapless Playback", isOn: Binding(
                    get: { prefs.gaplessPlayback },
                    set: { prefs.gaplessPlayback = $0 }
                ))
                Toggle("Normalize Volume", isOn: Binding(
                    get: { prefs.normalizeVolume },
                    set: { prefs.normalizeVolume = $0 }
                ))
                Toggle("Show Explicit Content", isOn: Binding(
                    get: { prefs.showExplicitContent },
                    set: { prefs.showExplicitContent = $0 }
                ))
            } else {
                Toggle("Gapless Playback", isOn: .constant(true))
                Toggle("Normalize Volume", isOn: .constant(false))
                Toggle("Show Explicit Content", isOn: .constant(true))
            }
        } header: {
            Text("Playback")
        }
    }
    
    private var storageSection: some View {
        Section {
            Toggle("Auto-Download on Wifi", isOn: Binding(
                get: { DatabaseManager.shared.activeProfile?.preferences?.autoDownloadOnWifi ?? false },
                set: { value in
                    DatabaseManager.shared.activeProfile?.preferences?.autoDownloadOnWifi = value
                    try? DatabaseManager.shared.saveContext()
                }
            ))
            NavigationLink {
                DownloadsView()
            } label: {
                Label("Manage Downloads", systemImage: "arrow.down.circle")
            }
        } header: {
            Text("Storage")
        }
    }
    
    private var aboutSection: some View {
        Section {
            Label("Version 1.0.0", systemImage: "info.circle")
            Label("Privacy Policy", systemImage: "hand.raised")
            Label("Terms of Service", systemImage: "doc.text")
            Label("Report a Problem", systemImage: "exclamationmark.bubble")
        } header: {
            Text("About")
        } footer: {
            Text("Melodix - Your Music. All Services. One App.")
        }
    }
    
    private func loadConnectedProviders() {
        connectedProviders = []
        for provider in MusicProviderType.allCases {
            if UserDefaults.standard.string(forKey: "\(provider.rawValue)_access_token") != nil {
                connectedProviders.insert(provider)
            }
        }
    }
}

struct AccountSettingsView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @State private var showSignOutConfirmation = false
    
    var body: some View {
        List {
            Section {
                if let profile = DatabaseManager.shared.activeProfile {
                    HStack(spacing: 12) {
                        AvatarView(profile: profile, size: 56)
                        VStack(alignment: .leading) {
                            Text(profile.name)
                                .font(.headline)
                            Text("Member since \(profile.createdAt.formatted(date: .abbreviated, time: .omitted))")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            
            Section("Security") {
                NavigationLink {
                    ChangePasswordView()
                } label: {
                    Label("Change Password", systemImage: "lock.rotation")
                }
                NavigationLink {
                    SecuritySettingsView()
                } label: {
                    Label("Security", systemImage: "shield.checkered")
                }
            }
            
            Section("Notifications") {
                Toggle("New Releases", isOn: .constant(true))
                Toggle("Playlist Updates", isOn: .constant(true))
                Toggle("Recommendations", isOn: .constant(true))
                Toggle("Social Activity", isOn: .constant(false))
            }
            
            Section {
                Button(role: .destructive) {
                    showSignOutConfirmation = true
                } label: {
                    Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
        }
        .navigationTitle("Account")
        .confirmationDialog(
            "Sign out of Melodix?",
            isPresented: $showSignOutConfirmation,
            titleVisibility: .visible
        ) {
            Button("Sign Out", role: .destructive) {
                DatabaseManager.shared.signOut()
            }
            Button("Cancel", role: .cancel) {}
        }
    }
}

struct ChangePasswordView: View {
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var isChanging = false
    @State private var showSuccess = false
    
    var body: some View {
        Form {
            Section("Current Password") {
                SecureField("Current Password", text: $currentPassword)
            }
            
            Section("New Password") {
                SecureField("New Password", text: $newPassword)
                SecureField("Confirm New Password", text: $confirmPassword)
            }
            
            Section {
                Button("Change Password") {
                    changePassword()
                }
                .disabled(currentPassword.isEmpty || newPassword.isEmpty || newPassword != confirmPassword)
            }
            
            if showSuccess {
                Section {
                    Label("Password changed successfully", systemImage: "checkmark.circle.fill")
                        .foregroundColor(.green)
                }
            }
        }
        .navigationTitle("Change Password")
    }
    
    private func changePassword() {
        isChanging = true
        Task {
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            isChanging = false
            showSuccess = true
            currentPassword = ""
            newPassword = ""
            confirmPassword = ""
        }
    }
}

struct SecuritySettingsView: View {
    @State private var isBiometricsEnabled = false
    
    var body: some View {
        Form {
            Section("Device") {
                Toggle("Sign in with Face ID / Touch ID", isOn: $isBiometricsEnabled)
                    .onChange(of: isBiometricsEnabled) { _, enabled in
                        if enabled {
                            // Enable biometrics
                        } else {
                            // Disable biometrics
                        }
                    }
            }
            
            Section("Sessions") {
                NavigationLink("Active Sessions") {
                    Text("Sessions list")
                }
            }
        }
        .navigationTitle("Security")
    }
}

struct DownloadsView: View {
    @State private var downloadedTracks: [DownloadedTrack] = []
    @State private var wifiOnly = true
    @State private var downloadQuality: AudioQuality = .high
    
    var body: some View {
        List {
            Section {
                Toggle("Download over Wi-Fi only", isOn: $wifiOnly)
                Picker("Download Quality", selection: $downloadQuality) {
                    ForEach(AudioQuality.allCases, id: \.self) { quality in
                        Text(quality.displayName).tag(quality)
                    }
                }
            }
            
            Section("Downloaded") {
                ForEach(downloadedTracks, id: \.id) { download in
                    HStack {
                        Text(download.track.title)
                        Spacer()
                        Text(formatFileSize(download.fileSize))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Downloads")
        .onAppear {
            if let profile = DatabaseManager.shared.activeProfile {
                downloadedTracks = (try? DatabaseManager.shared.downloadedTracks(for: profile)) ?? []
            }
        }
    }
    
    private func formatFileSize(_ size: Int64) -> String {
        ByteCountFormatter.string(fromByteCount: size, countStyle: .file)
    }
}

struct ProviderConnectionView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var themeManager: ThemeManager
    @State private var connectingProvider: MusicProviderType?
    @State private var connectionError: String?
    
    var body: some View {
        NavigationStack {
            List {
                ForEach([MusicProviderType.youtubeMusic, .qobuz, .tidal, .custom, .local], id: \.self) { provider in
                    providerRow(provider)
                }
            }
            .navigationTitle("Music Services")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .alert("Connection Error", isPresented: Binding(
                get: { connectionError != nil },
                set: { if !$0 { connectionError = nil } }
            )) {
                Button("OK") { connectionError = nil }
            } message: {
                Text(connectionError ?? "")
            }
        }
    }
    
    private func providerRow(_ provider: MusicProviderType) -> some View {
        let isConnected = UserDefaults.standard.string(forKey: "\(provider.rawValue)_access_token") != nil
        
        return HStack(spacing: 12) {
            Image(systemName: provider.iconName)
                .font(.title2)
                .foregroundColor(providerColor(provider))
                .frame(width: 40, height: 40)
                .background(providerColor(provider).opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            
            VStack(alignment: .leading, spacing: 2) {
                Text(providerName(provider))
                    .font(.headline)
                Text(isConnected ? "Connected" : "Not connected")
                    .font(.caption)
                    .foregroundColor(isConnected ? .green : .secondary)
            }
            
            Spacer()
            
            if isConnected {
                Menu {
                    Button("Disconnect", role: .destructive) {
                        ProviderFactory.shared.clearCredentials(for: provider)
                    }
                } label: {
                    Text("Connected")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.green)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.green.opacity(0.15))
                        .clipShape(Capsule())
                }
            } else {
                Button("Connect") {
                    connect(provider)
                }
                .font(.caption.weight(.semibold))
                .buttonStyle(.borderedProminent)
                .tint(themeManager.accentColor)
                .disabled(connectingProvider != nil)
            }
        }
        .padding(.vertical, 4)
    }
    
    private func connect(_ provider: MusicProviderType) {
        connectingProvider = provider
        connectionError = nil
        
        Task {
            do {
                let service = ProviderFactory.shared.provider(provider)
                let result = try await service.authenticate()
                ProviderFactory.shared.saveCredentials(result, for: provider)
                connectingProvider = nil
            } catch {
                connectingProvider = nil
                connectionError = error.localizedDescription
            }
        }
    }
    
    private func providerName(_ type: MusicProviderType) -> String {
        switch type {
        case .youtubeMusic: return "YouTube Music"
        case .qobuz: return "Qobuz"
        case .tidal: return "Tidal"
        case .custom: return "Custom Service"
        case .local: return "Local Files"
        }
    }
    
    private func providerColor(_ type: MusicProviderType) -> Color {
        switch type {
        case .youtubeMusic: return .red
        case .qobuz: return .blue
        case .tidal: return .purple
        case .custom: return .orange
        case .local: return .green
        }
    }
}