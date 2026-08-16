import Foundation

protocol MusicService: Sendable {
    var providerType: MusicProviderType { get }
    var displayName: String { get }
    var iconName: String { get }
    var requiresAuth: Bool { get }
    var supportedQualities: [AudioQuality] { get }
    
    func authenticate() async throws -> ProviderAuthResult
    func refreshToken() async throws -> String
    func signOut() async throws
    
    func search(query: String, types: [SearchType], limit: Int, offset: Int) async throws -> SearchResults
    func getTrack(id: String, quality: AudioQuality) async throws -> Track
    func getAlbum(id: String) async throws -> Album
    func getArtist(id: String) async throws -> Artist
    func getPlaylist(id: String) async throws -> ProviderPlaylist
    func getUserPlaylists() async throws -> [ProviderPlaylist]
    func getUserLibrary() async throws -> UserLibrary
    func getRecommendations(basedOn: [String], limit: Int) async throws -> [Track]
    func getCharts() async throws -> Charts
    func getNewReleases() async throws -> [Album]
    
    func getStreamURL(for track: Track, quality: AudioQuality) async throws -> URL
    func getLyrics(for track: Track) async throws -> Lyrics?
    
    func addToLibrary(_ item: LibraryItem) async throws
    func removeFromLibrary(_ item: LibraryItem) async throws
    func createPlaylist(name: String, description: String?, tracks: [Track]) async throws -> ProviderPlaylist
    func addTracksToPlaylist(_ tracks: [Track], playlistId: String) async throws
    func removeTracksFromPlaylist(_ tracks: [Track], playlistId: String) async throws
}

enum MusicProviderType: String, CaseIterable, Sendable {
    case youtubeMusic = "youtube_music"
    case qobuz = "qobuz"
    case tidal = "tidal"
    case custom = "custom"
    case local = "local"
    
    var displayName: String {
        switch self {
        case .youtubeMusic: return "YouTube Music"
        case .qobuz: return "Qobuz"
        case .tidal: return "Tidal"
        case .custom: return "Custom"
        case .local: return "Local Files"
        }
    }
    
    var iconName: String {
        switch self {
        case .youtubeMusic: return "music.note.list"
        case .qobuz: return "waveform"
        case .tidal: return "water.waves"
        case .custom: return "gear"
        case .local: return "folder"
        }
    }
}

struct ProviderAuthResult: Sendable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: TimeInterval?
    let userId: String
    let username: String
}

enum SearchType: String, CaseIterable, Sendable {
    case track = "track"
    case album = "album"
    case artist = "artist"
    case playlist = "playlist"
    case video = "video"
}

struct SearchResults: Sendable {
    let tracks: [Track]
    let albums: [Album]
    let artists: [Artist]
    let playlists: [ProviderPlaylist]
    let videos: [Video]
}

struct Album: Identifiable, Sendable {
    let id: String
    let title: String
    let artist: String
    let artistId: String
    let artworkURL: String?
    let releaseDate: Date?
    let trackCount: Int
    let duration: TimeInterval
    let provider: MusicProviderType
    let providerID: String
    let isExplicit: Bool
    let genres: [String]
    let copyright: String?
}

struct Artist: Identifiable, Sendable {
    let id: String
    let name: String
    let artworkURL: String?
    let biography: String?
    let genres: [String]
    let provider: MusicProviderType
    let providerID: String
    let monthlyListeners: Int?
}

struct ProviderPlaylist: Identifiable, Sendable {
    let id: String
    let name: String
    let description: String?
    let artworkURL: String?
    let trackCount: Int
    let duration: TimeInterval
    let owner: String
    let ownerId: String
    let isPublic: Bool
    let isCollaborative: Bool
    let provider: MusicProviderType
    let providerID: String
    let createdAt: Date
    let updatedAt: Date
}

struct UserLibrary: Sendable {
    let tracks: [Track]
    let albums: [Album]
    let artists: [Artist]
    let playlists: [ProviderPlaylist]
}

struct Charts: Sendable {
    let topTracks: [Track]
    let topAlbums: [Album]
    let topArtists: [Artist]
    let topPlaylists: [ProviderPlaylist]
    let trending: [Track]
}

struct Video: Identifiable, Sendable {
    let id: String
    let title: String
    let artist: String
    let thumbnailURL: String?
    let duration: TimeInterval
    let viewCount: Int
    let provider: MusicProviderType
    let providerID: String
}

struct Lyrics: Sendable {
    let text: String
    let syncData: [LyricLine]?
    let language: String?
    let provider: MusicProviderType
}

struct LyricLine: Sendable {
    let time: TimeInterval
    let text: String
}

enum LibraryItem: Sendable {
    case track(Track)
    case album(Album)
    case artist(Artist)
    case playlist(ProviderPlaylist)
}

extension MusicService {
    var requiresAuth: Bool {
        switch providerType {
        case .youtubeMusic, .qobuz, .tidal: return true
        case .custom, .local: return false
        }
    }
    
    var supportedQualities: [AudioQuality] {
        switch providerType {
        case .youtubeMusic: return [.low, .standard, .high]
        case .qobuz: return [.standard, .high, .lossless, .hires]
        case .tidal: return [.standard, .high, .lossless, .hires]
        case .custom: return AudioQuality.allCases
        case .local: return AudioQuality.allCases
        }
    }
}

protocol ProviderAuthenticator: Sendable {
    func startAuthentication() async throws -> URL
    func handleCallback(url: URL) async throws -> ProviderAuthResult
    func refreshAccessToken(_ refreshToken: String) async throws -> String
    func revokeAccess() async throws
}