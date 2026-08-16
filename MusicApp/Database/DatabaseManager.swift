import Foundation
import SwiftData
import Combine
import UIKit
import CryptoKit

@MainActor
final class DatabaseManager {
    static let shared = DatabaseManager()
    
    private var modelContext: ModelContext?
    
    @Published private(set) var profiles: [UserProfile] = []
    @Published private(set) var activeProfile: UserProfile?
    @Published private(set) var authState: AuthState = .signedOut
    
    enum AuthState {
        case signedOut
        case signedIn
    }
    
    private init() {}
    
    func configure(modelContext: ModelContext) {
        self.modelContext = modelContext
        loadProfiles()
    }
    
    func loadProfiles() {
        guard let modelContext = modelContext else { return }
        
        let descriptor = FetchDescriptor<UserProfile>(
            sortBy: [SortDescriptor(\.createdAt)]
        )
        
        do {
            profiles = try modelContext.fetch(descriptor)
            activeProfile = profiles.first(where: { $0.isActive }) ?? profiles.first
        } catch {
            print("Failed to load profiles: \(error)")
        }
    }
    
    // MARK: - Account & Auth
    
    func createAccount(email: String, password: String, name: String) async throws -> UserProfile {
        let hashedPassword = hashPassword(password, salt: email)
        
        let account = try await createAccountServerSide(email: email, hashedPassword: hashedPassword)
        
        let profile = UserProfile(name: name, isActive: true)
        insert(profile)
        
        let preferences = UserPreferences()
        let theme = ThemeConfiguration(name: "Default")
        let eqPreset = EQPreset(name: "Flat")
        
        preferences.profile = profile
        theme.profile = profile
        eqPreset.profile = profile
        profile.preferences = preferences
        
        for provider in MusicProviderType.allCases where provider != .local {
            let credentials = ProviderCredentials(provider: provider)
            credentials.profile = profile
            profile.providerCredentials.append(credentials)
        }
        
        save()
        loadProfiles()
        authState = .signedIn
        
        return profile
    }
    
    func login(email: String, password: String) async throws -> UserProfile {
        let hashedPassword = hashPassword(password, salt: email)
        
        let account = try await loginServerSide(email: email, hashedPassword: hashedPassword)
        
        guard let profile = profiles.first(where: { $0.name == account.username || $0.id.uuidString == account.userId }) ?? profiles.first else {
            throw DatabaseError.accountNotFound
        }
        
        setActiveProfile(profile)
        authState = .signedIn
        return profile
    }
    
    func signOut() {
        authState = .signedOut
    }
    
    // MARK: - Profile Management
    
    func setActiveProfile(_ profile: UserProfile) {
        guard let modelContext = modelContext else { return }
        
        for p in profiles {
            p.isActive = false
        }
        profile.isActive = true
        profile.lastUsedAt = Date()
        save()
        loadProfiles()
    }
    
    func createProfile(name: String, avatarColor: String, isKids: Bool = false) throws -> UserProfile {
        let profile = UserProfile(name: name, avatarColor: avatarColor, isKidsProfile: isKids)
        
        let preferences = UserPreferences()
        let theme = ThemeConfiguration(name: "\(name)'s Theme")
        let eqPreset = EQPreset(name: "Flat")
        
        preferences.profile = profile
        theme.profile = profile
        eqPreset.profile = profile
        profile.preferences = preferences
        
        for provider in MusicProviderType.allCases where provider != .local {
            let credentials = ProviderCredentials(provider: provider)
            credentials.profile = profile
            profile.providerCredentials.append(credentials)
        }
        
        insert(profile)
        save()
        loadProfiles()
        return profile
    }
    
    func deleteProfile(_ profile: UserProfile) throws {
        guard profiles.count > 1 else {
            throw DatabaseError.cannotDeleteLastProfile
        }
        
        let wasActive = profile.isActive
        
        modelContext?.delete(profile)
        save()
        loadProfiles()
        
        if wasActive {
            if let newActive = profiles.first {
                setActiveProfile(newActive)
            }
        }
    }
    
    func renameProfile(_ profile: UserProfile, to name: String) {
        profile.name = name
        save()
        loadProfiles()
    }
    
    func updateProfileAvatar(_ profile: UserProfile, color: String) {
        profile.avatarColor = color
        save()
    }
    
    func updateProfileAvatarImage(_ profile: UserProfile, imageData: Data) {
        profile.avatarData = imageData
        save()
    }
    
    // MARK: - Playlists
    
    func createPlaylist(name: String, description: String?, for profile: UserProfile) throws -> Playlist {
        let playlist = Playlist(name: name, description: description)
        playlist.profile = profile
        insert(playlist)
        save()
        return playlist
    }
    
    func playlists(for profile: UserProfile) throws -> [Playlist] {
        guard let modelContext = modelContext else { return [] }
        let descriptor = FetchDescriptor<Playlist>(
            predicate: #Predicate { $0.profile == profile },
            sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
        )
        return try modelContext.fetch(descriptor)
    }
    
    func addTrack(_ track: Track, to playlist: Playlist) {
        guard !playlist.tracks.contains(where: { $0.track.id == track.id }) else { return }
        let playlistTrack = PlaylistTrack(track: track, position: playlist.tracks.count)
        playlistTrack.playlist = playlist
        insert(playlistTrack)
        playlist.updatedAt = Date()
        save()
    }
    
    func removeTrack(at index: Int, from playlist: Playlist) {
        guard index < playlist.tracks.count else { return }
        modelContext?.delete(playlist.tracks[index])
        playlist.tracks.remove(at: index)
        playlist.updatedAt = Date()
        save()
    }
    
    // MARK: - Play History
    
    func recordPlay(_ track: Track, duration: TimeInterval, completed: Bool, for profile: UserProfile) {
        let history = PlayHistory(track: track, playDuration: duration, completed: completed)
        history.profile = profile
        insert(history)
        track.playCount += 1
        track.lastPlayedAt = Date()
        save()
    }
    
    func playHistory(for profile: UserProfile, limit: Int = 50) throws -> [PlayHistory] {
        guard let modelContext = modelContext else { return [] }
        let descriptor = FetchDescriptor<PlayHistory>(
            predicate: #Predicate { $0.profile == profile },
            sortBy: [SortDescriptor(\.playedAt, order: .reverse)]
        )
        var history = try modelContext.fetch(descriptor)
        if history.count > limit {
            history = Array(history.prefix(limit))
        }
        return history
    }
    
    // MARK: - EQ Presets
    
    func saveEQPreset(_ preset: EQPreset, for profile: UserProfile) {
        preset.profile = profile
        insert(preset)
        save()
    }
    
    func deleteEQPreset(_ preset: EQPreset) {
        modelContext?.delete(preset)
        save()
    }
    
    func eqPresets(for profile: UserProfile) throws -> [EQPreset] {
        guard let modelContext = modelContext else { return [] }
        let descriptor = FetchDescriptor<EQPreset>(
            predicate: #Predicate { $0.profile == profile },
            sortBy: [SortDescriptor(\.name)]
        )
        return try modelContext.fetch(descriptor)
    }
    
    // MARK: - Themes
    
    func saveTheme(_ theme: ThemeConfiguration, for profile: UserProfile) {
        theme.profile = profile
        insert(theme)
        save()
    }
    
    func themes(for profile: UserProfile) throws -> [ThemeConfiguration] {
        guard let modelContext = modelContext else { return [] }
        let descriptor = FetchDescriptor<ThemeConfiguration>(
            predicate: #Predicate { $0.profile == profile },
            sortBy: [SortDescriptor(\.name)]
        )
        return try modelContext.fetch(descriptor)
    }
    
    func deleteTheme(_ theme: ThemeConfiguration) {
        modelContext?.delete(theme)
        save()
    }
    
    func applyTheme(_ theme: ThemeConfiguration, to profile: UserProfile) {
        profile.preferences?.themeConfiguration = theme
        save()
    }
    
    // MARK: - Downloads
    
    func markTrackDownloaded(_ track: Track, url: URL, size: Int64, for profile: UserProfile, expiresAt: Date? = nil) {
        let download = DownloadedTrack(track: track, localURL: url, fileSize: size)
        download.profile = profile
        download.expiresAt = expiresAt
        insert(download)
        save()
    }
    
    func downloadedTracks(for profile: UserProfile) throws -> [DownloadedTrack] {
        guard let modelContext = modelContext else { return [] }
        let descriptor = FetchDescriptor<DownloadedTrack>(
            predicate: #Predicate { $0.profile == profile },
            sortBy: [SortDescriptor(\.downloadDate, order: .reverse)]
        )
        return try modelContext.fetch(descriptor)
    }
    
    // MARK: - Private Helpers
    
    private func insert(_ model: any PersistentModel) {
        guard let modelContext = modelContext else { return }
        modelContext.insert(model)
    }
    
    private func save() {
        guard let modelContext = modelContext else { return }
        do {
            try modelContext.save()
        } catch {
            print("Failed to save context: \(error)")
        }
    }
    
    func saveContext() throws {
        guard let modelContext = modelContext else {
            throw DatabaseError.notConfigured
        }
        do {
            try modelContext.save()
        } catch {
            print("Failed to save context: \(error)")
            throw error
        }
    }
    
    private func hashPassword(_ password: String, salt: String) -> String {
        var hasher = SHA256()
        hasher.update(data: Data((password + salt).utf8))
        let digest = hasher.finalize()
        return digest.map { String(format: "%02x", $0) }.joined()
    }
    
    private func createAccountServerSide(email: String, hashedPassword: String) async throws -> RemoteAccount {
        let config = AppConfig.shared
        guard let url = URL(string: "\(config.apiBaseURL)/auth/register") else {
            throw DatabaseError.invalidConfiguration
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode([
            "email": email,
            "password_hash": hashedPassword,
            "device_id": UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        ])
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw DatabaseError.networkError
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw DatabaseError.serverError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(RemoteAccount.self, from: data)
    }
    
    private func loginServerSide(email: String, hashedPassword: String) async throws -> RemoteAccount {
        let config = AppConfig.shared
        guard let url = URL(string: "\(config.apiBaseURL)/auth/login") else {
            throw DatabaseError.invalidConfiguration
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode([
            "email": email,
            "password_hash": hashedPassword,
            "device_id": UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        ])
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw DatabaseError.networkError
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw DatabaseError.serverError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(RemoteAccount.self, from: data)
    }
}

struct RemoteAccount: Codable {
    let userId: String
    let username: String
    let email: String
    let accessToken: String?
    let refreshToken: String?
}

enum DatabaseError: Error, LocalizedError {
    case accountNotFound
    case cannotDeleteLastProfile
    case invalidConfiguration
    case networkError
    case serverError(Int)
    case notConfigured
    
    var errorDescription: String? {
        switch self {
        case .accountNotFound: return "Account not found"
        case .cannotDeleteLastProfile: return "Cannot delete the last profile"
        case .invalidConfiguration: return "Invalid app configuration"
        case .networkError: return "Network error occurred"
        case .serverError(let code): return "Server error: \(code)"
        case .notConfigured: return "Database not configured"
        }
    }
}

final class AppConfig {
    static let shared = AppConfig()
    
    private init() {}
    
    var apiBaseURL: String {
        UserDefaults.standard.string(forKey: "api_base_url") ?? "https://api.musicapp.example.com"
    }
    
    func setAPIBaseURL(_ url: String) {
        UserDefaults.standard.set(url, forKey: "api_base_url")
    }
}