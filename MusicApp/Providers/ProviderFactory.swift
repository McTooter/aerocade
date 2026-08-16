import Foundation
import UIKit
import AVFoundation

final class ProviderFactory {
    static let shared = ProviderFactory()
    
    private var providers: [MusicProviderType: any MusicService] = [:]
    
    private init() {
        register(.youtubeMusic, YouTubeMusicProvider())
        register(.qobuz, QobuzProvider())
        register(.tidal, TidalProvider())
        register(.custom, CustomProvider())
        register(.local, LocalFilesProvider())
    }
    
    func register(_ type: MusicProviderType, _ provider: some MusicService) {
        providers[type] = provider
    }
    
    func provider(_ type: MusicProviderType) -> any MusicService {
        guard let provider = providers[type] else {
            fatalError("Provider not registered: \(type)")
        }
        return provider
    }
    
    func allProviders() -> [any MusicService] {
        MusicProviderType.allCases.compactMap { providers[$0] }
    }
    
    func loggedInProviders() -> [any MusicService] {
        allProviders().filter { !$0.requiresAuth || hasCredentials(for: $0.providerType) }
    }
    
    private func hasCredentials(for type: MusicProviderType) -> Bool {
        UserDefaults.standard.string(forKey: "\(type.rawValue)_access_token") != nil
    }
    
    func saveCredentials(_ result: ProviderAuthResult, for type: MusicProviderType) {
        let defaults = UserDefaults.standard
        defaults.set(result.accessToken, forKey: "\(type.rawValue)_access_token")
        defaults.set(result.refreshToken, forKey: "\(type.rawValue)_refresh_token")
        defaults.set(result.userId, forKey: "\(type.rawValue)_user_id")
        defaults.set(result.username, forKey: "\(type.rawValue)_username")
        if let expiresIn = result.expiresIn {
            defaults.set(Date().addingTimeInterval(expiresIn), forKey: "\(type.rawValue)_expires_at")
        }
    }
    
    func clearCredentials(for type: MusicProviderType) {
        let defaults = UserDefaults.standard
        let keys = [
            "\(type.rawValue)_access_token",
            "\(type.rawValue)_refresh_token",
            "\(type.rawValue)_user_id",
            "\(type.rawValue)_username",
            "\(type.rawValue)_expires_at"
        ]
        keys.forEach { defaults.removeObject(forKey: $0) }
    }
}

struct LocalFilesProvider: MusicService {
    let providerType: MusicProviderType = .local
    let displayName: String = "Local Files"
    let iconName: String = "folder"
    let supportedQualities: [AudioQuality] = [.standard, .high, .lossless]
    
    func authenticate() async throws -> ProviderAuthResult {
        throw ProviderError.notImplemented
    }
    
    func refreshToken() async throws -> String {
        throw ProviderError.notImplemented
    }
    
    func signOut() async throws {}
    
    func search(query: String, types: [SearchType], limit: Int, offset: Int) async throws -> SearchResults {
        let tracks = LocalLibrary.shared.searchTracks(query)
        return SearchResults(tracks: tracks, albums: [], artists: [], playlists: [], videos: [])
    }
    
    func getTrack(id: String, quality: AudioQuality) async throws -> Track {
        guard let track = LocalLibrary.shared.track(withID: id) else {
            throw ProviderError.invalidResponse
        }
        return track
    }
    
    func getAlbum(id: String) async throws -> Album {
        throw ProviderError.notImplemented
    }
    
    func getArtist(id: String) async throws -> Artist {
        throw ProviderError.notImplemented
    }
    
    func getPlaylist(id: String) async throws -> ProviderPlaylist {
        throw ProviderError.notImplemented
    }
    
    func getUserPlaylists() async throws -> [ProviderPlaylist] {
        return []
    }
    
    func getUserLibrary() async throws -> UserLibrary {
        return UserLibrary(
            tracks: LocalLibrary.shared.allTracks(),
            albums: [],
            artists: [],
            playlists: []
        )
    }
    
    func getRecommendations(basedOn: [String], limit: Int) async throws -> [Track] {
        return []
    }
    
    func getCharts() async throws -> Charts {
        return Charts(topTracks: [], topAlbums: [], topArtists: [], topPlaylists: [], trending: [])
    }
    
    func getNewReleases() async throws -> [Album] {
        return []
    }
    
    func getStreamURL(for track: Track, quality: AudioQuality) async throws -> URL {
        guard let urlString = track.localFileURL else {
            throw ProviderError.noStreamURL
        }
        return URL(fileURLWithPath: urlString)
    }
    
    func getLyrics(for track: Track) async throws -> Lyrics? {
        return nil
    }
    
    func addToLibrary(_ item: LibraryItem) async throws {
        throw ProviderError.notImplemented
    }
    
    func removeFromLibrary(_ item: LibraryItem) async throws {
        throw ProviderError.notImplemented
    }
    
    func createPlaylist(name: String, description: String?, tracks: [Track]) async throws -> ProviderPlaylist {
        throw ProviderError.notImplemented
    }
    
    func addTracksToPlaylist(_ tracks: [Track], playlistId: String) async throws {
        throw ProviderError.notImplemented
    }
    
    func removeTracksFromPlaylist(_ tracks: [Track], playlistId: String) async throws {
        throw ProviderError.notImplemented
    }
}

final class LocalLibrary {
    static let shared = LocalLibrary()
    
    private var tracks: [Track] = []
    
    private init() {}
    
    func addTrack(_ track: Track) {
        if !tracks.contains(where: { $0.id == track.id }) {
            tracks.append(track)
        }
    }
    
    func removeTrack(_ track: Track) {
        tracks.removeAll { $0.id == track.id }
    }
    
    func allTracks() -> [Track] {
        tracks.sorted { $0.title < $1.title }
    }
    
    func track(withID id: String) -> Track? {
        tracks.first { $0.id == id }
    }
    
    func searchTracks(_ query: String) -> [Track] {
        let lowercased = query.lowercased()
        return tracks.filter {
            $0.title.lowercased().contains(lowercased) ||
            $0.artist.lowercased().contains(lowercased) ||
            ($0.album?.lowercased().contains(lowercased) ?? false)
        }
    }
    
    func importFromFiles(_ urls: [URL]) async throws -> [Track] {
        var imported: [Track] = []
        for url in urls {
            do {
                let isAccessible = url.startAccessingSecurityScopedResource()
                defer { if isAccessible { url.stopAccessingSecurityScopedResource() } }
                
                let audioFile = try AVAudioFile(forReading: url)
                let duration = Double(audioFile.length) / audioFile.fileFormat.sampleRate
                let filename = url.deletingPathExtension().lastPathComponent
                
                let track = Track(
                    id: url.absoluteString,
                    title: filename,
                    artist: "Unknown",
                    provider: .local,
                    providerID: url.absoluteString,
                    duration: duration
                )
                track.localFileURL = url.path
                track.audioQuality = .high
                addTrack(track)
                imported.append(track)
            } catch {
                print("Failed to import \(url.lastPathComponent): \(error)")
            }
        }
        return imported
    }
}