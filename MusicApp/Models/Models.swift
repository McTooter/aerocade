import Foundation
import SwiftData
import SwiftUI

@Model
final class UserProfile {
    var id: UUID
    var name: String
    var avatarData: Data?
    var avatarColor: String
    var isActive: Bool
    var isKidsProfile: Bool
    var createdAt: Date
    var lastUsedAt: Date
    var preferences: UserPreferences?
    var playlists: [Playlist]
    var playHistory: [PlayHistory]
    var downloadedTracks: [DownloadedTrack]
    var providerCredentials: [ProviderCredentials]
    
    init(
        id: UUID = UUID(),
        name: String,
        avatarColor: String = "blue",
        isActive: Bool = false,
        isKidsProfile: Bool = false
    ) {
        self.id = id
        self.name = name
        self.avatarColor = avatarColor
        self.isActive = isActive
        self.isKidsProfile = isKidsProfile
        self.createdAt = Date()
        self.lastUsedAt = Date()
        self.playlists = []
        self.playHistory = []
        self.downloadedTracks = []
        self.providerCredentials = []
    }
}

@Model
final class UserPreferences {
    var id: UUID
    var profile: UserProfile?
    var themeConfiguration: ThemeConfiguration?
    var eqPreset: EQPreset?
    var audioQuality: AudioQuality
    var crossfadeDuration: TimeInterval
    var gaplessPlayback: Bool
    var normalizeVolume: Bool
    var showExplicitContent: Bool
    var autoDownloadOnWifi: Bool
    var downloadQuality: AudioQuality
    var preferredProviders: [MusicProvider]
    var notificationSettings: NotificationSettings
    var playbackSpeed: Float
    var sleepTimerDuration: TimeInterval?
    
    init() {
        self.id = UUID()
        self.audioQuality = .high
        self.crossfadeDuration = 0
        self.gaplessPlayback = true
        self.normalizeVolume = false
        self.showExplicitContent = true
        self.autoDownloadOnWifi = false
        self.downloadQuality = .high
        self.preferredProviders = [.custom]
        self.notificationSettings = NotificationSettings()
        self.playbackSpeed = 1.0
    }
}

@Model
final class Playlist {
    var id: UUID
    var name: String
    var description: String?
    var artworkData: Data?
    var isSmartPlaylist: Bool
    var smartRules: [SmartPlaylistRule]
    var tracks: [PlaylistTrack]
    var createdAt: Date
    var updatedAt: Date
    var profile: UserProfile?
    
    init(name: String, description: String? = nil, isSmartPlaylist: Bool = false) {
        self.id = UUID()
        self.name = name
        self.description = description
        self.isSmartPlaylist = isSmartPlaylist
        self.smartRules = []
        self.tracks = []
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}

@Model
final class PlaylistTrack {
    var id: UUID
    var playlist: Playlist?
    var track: Track
    var position: Int
    var addedAt: Date
    
    init(track: Track, position: Int) {
        self.id = UUID()
        self.track = track
        self.position = position
        self.addedAt = Date()
    }
}

@Model
final class Track {
    var id: String
    var title: String
    var artist: String
    var album: String?
    var albumArtist: String?
    var artworkURL: String?
    var artworkData: Data?
    var duration: TimeInterval
    var trackNumber: Int?
    var discNumber: Int?
    var year: Int?
    var genre: String?
    var composer: String?
    var lyrics: String?
    var isExplicit: Bool
    var provider: MusicProvider
    var providerID: String
    var streamURL: String?
    var localFileURL: String?
    var audioQuality: AudioQuality
    var fileSize: Int64?
    var dateAdded: Date
    var playCount: Int
    var lastPlayedAt: Date?
    var bpm: Double?
    var key: String?
    var replayGain: Float?
    
    init(
        id: String,
        title: String,
        artist: String,
        provider: MusicProvider,
        providerID: String,
        duration: TimeInterval
    ) {
        self.id = id
        self.title = title
        self.artist = artist
        self.provider = provider
        self.providerID = providerID
        self.duration = duration
        self.isExplicit = false
        self.audioQuality = .standard
        self.dateAdded = Date()
        self.playCount = 0
    }
}

@Model
final class PlayHistory {
    var id: UUID
    var track: Track
    var playedAt: Date
    var playDuration: TimeInterval
    var completed: Bool
    var profile: UserProfile?
    
    init(track: Track, playDuration: TimeInterval, completed: Bool) {
        self.id = UUID()
        self.track = track
        self.playedAt = Date()
        self.playDuration = playDuration
        self.completed = completed
    }
}

@Model
final class EQPreset {
    var id: UUID
    var name: String
    var isCustom: Bool
    var bands: [EQBand]
    var preamp: Float
    var profile: UserProfile?
    
    init(name: String, bands: [EQBand] = EQPreset.defaultBands, preamp: Float = 0) {
        self.id = UUID()
        self.name = name
        self.isCustom = true
        self.bands = bands
        self.preamp = preamp
    }
    
    static let defaultBands: [EQBand] = [
        EQBand(frequency: 32, gain: 0, q: 1.0),
        EQBand(frequency: 64, gain: 0, q: 1.0),
        EQBand(frequency: 125, gain: 0, q: 1.0),
        EQBand(frequency: 250, gain: 0, q: 1.0),
        EQBand(frequency: 500, gain: 0, q: 1.0),
        EQBand(frequency: 1000, gain: 0, q: 1.0),
        EQBand(frequency: 2000, gain: 0, q: 1.0),
        EQBand(frequency: 4000, gain: 0, q: 1.0),
        EQBand(frequency: 8000, gain: 0, q: 1.0),
        EQBand(frequency: 16000, gain: 0, q: 1.0)
    ]
}

struct EQBand: Codable {
    var frequency: Float
    var gain: Float
    var q: Float
    
    init(frequency: Float, gain: Float, q: Float) {
        self.frequency = frequency
        self.gain = gain
        self.q = q
    }
}

@Model
final class ThemeConfiguration {
    var id: UUID
    var name: String
    var isCustom: Bool
    var primaryColor: String
    var secondaryColor: String
    var backgroundColor: String
    var surfaceColor: String
    var accentColor: String
    var textPrimaryColor: String
    var textSecondaryColor: String
    var fontName: String
    var fontSizeMultiplier: Float
    var cornerRadius: Float
    var blurIntensity: Float
    var animationSpeed: Float
    var colorScheme: ColorSchemeOption
    var profile: UserProfile?
    
    init(name: String, isCustom: Bool = true) {
        self.id = UUID()
        self.name = name
        self.isCustom = isCustom
        self.primaryColor = "#007AFF"
        self.secondaryColor = "#5856D6"
        self.backgroundColor = "#000000"
        self.surfaceColor = "#1C1C1E"
        self.accentColor = "#FF3B30"
        self.textPrimaryColor = "#FFFFFF"
        self.textSecondaryColor = "#8E8E93"
        self.fontName = "SF Pro"
        self.fontSizeMultiplier = 1.0
        self.cornerRadius = 12
        self.blurIntensity = 20
        self.animationSpeed = 1.0
        self.colorScheme = .system
    }
}

@Model
final class ProviderCredentials {
    var id: UUID
    var provider: MusicProvider
    var accessToken: String?
    var refreshToken: String?
    var tokenExpiresAt: Date?
    var userID: String?
    var username: String?
    var isLoggedIn: Bool
    var profile: UserProfile?
    
    init(provider: MusicProvider) {
        self.id = UUID()
        self.provider = provider
        self.isLoggedIn = false
    }
}

@Model
final class DownloadedTrack {
    var id: UUID
    var track: Track
    var localURL: URL
    var fileSize: Int64
    var downloadDate: Date
    var expiresAt: Date?
    var profile: UserProfile?
    
    init(track: Track, localURL: URL, fileSize: Int64) {
        self.id = UUID()
        self.track = track
        self.localURL = localURL
        self.fileSize = fileSize
        self.downloadDate = Date()
    }
}

struct SmartPlaylistRule: Codable {
    enum RuleType: String, Codable { case genre, artist, year, playCount, rating, bpm, key, dateAdded }
    enum Operator: String, Codable { case equals, notEquals, contains, greaterThan, lessThan, between }
    
    var type: RuleType
    var op: Operator
    var value: String
    var value2: String?
}

enum MusicProvider: String, Codable, CaseIterable {
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

enum AudioQuality: String, Codable, CaseIterable {
    case low = "low"
    case standard = "standard"
    case high = "high"
    case lossless = "lossless"
    case hires = "hires"
    
    var bitrate: Int {
        switch self {
        case .low: return 96
        case .standard: return 160
        case .high: return 320
        case .lossless: return 1411
        case .hires: return 9216
        }
    }
    
    var displayName: String {
        switch self {
        case .low: return "Low (96 kbps)"
        case .standard: return "Standard (160 kbps)"
        case .high: return "High (320 kbps)"
        case .lossless: return "Lossless (1411 kbps)"
        case .hires: return "Hi-Res (9216 kbps)"
        }
    }
}

enum ColorSchemeOption: String, Codable, CaseIterable {
    case light = "light"
    case dark = "dark"
    case system = "system"
    case custom = "custom"
    
    var colorScheme: ColorScheme? {
        switch self {
        case .light: return .light
        case .dark: return .dark
        case .system: return nil
        case .custom: return nil
        }
    }
}

struct NotificationSettings: Codable {
    var newReleases: Bool = true
    var playlistUpdates: Bool = true
    var recommendations: Bool = true
    var socialActivity: Bool = false
    var downloadComplete: Bool = true
}