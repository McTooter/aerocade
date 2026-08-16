import Foundation
import CryptoKit

struct YouTubeMusicProvider: MusicService {
    let providerType: MusicProviderType = .youtubeMusic
    let displayName: String = "YouTube Music"
    let iconName: String = "music.note.list"
    let supportedQualities: [AudioQuality] = [.low, .standard, .high]
    
    private let baseURL = "https://music.youtube.com/youtubei/v1"
    private let clientName = "WEB_REMIX"
    private let clientVersion = "1.20240101.01.00"
    private var authToken: String?
    private var sessionId: String?
    
    func authenticate() async throws -> ProviderAuthResult {
        let authURL = "https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=https://www.googleapis.com/auth/youtube.readonly&access_type=offline"
        throw ProviderError.authenticationRequired(authURL)
    }
    
    func refreshToken() async throws -> String {
        throw ProviderError.notImplemented
    }
    
    func signOut() async throws {
        authToken = nil
        sessionId = nil
    }
    
    func search(query: String, types: [SearchType], limit: Int, offset: Int) async throws -> SearchResults {
        let body = YTMSearchRequest(
            query: query,
            params: "EgWKAQIIAWoKEAMQBRADEA==",
            musicTypes: types.map { $0.rawValue }
        )
        
        let response: YTMSearchResponse = try await performRequest(endpoint: "music/search", body: body)
        return parseSearchResults(response)
    }
    
    func getTrack(id: String, quality: AudioQuality) async throws -> Track {
        let body = YTMGetTrackRequest(videoId: id)
        let response: YTMGetTrackResponse = try await performRequest(endpoint: "music/get_track", body: body)
        return parseTrack(response.track, quality: quality)
    }
    
    func getAlbum(id: String) async throws -> Album {
        let body = YTMGetAlbumRequest(browseId: id)
        let response: YTMGetAlbumResponse = try await performRequest(endpoint: "browse", body: body)
        return parseAlbum(response)
    }
    
    func getArtist(id: String) async throws -> Artist {
        let body = YTMGetArtistRequest(browseId: id)
        let response: YTMGetArtistResponse = try await performRequest(endpoint: "browse", body: body)
        return parseArtist(response)
    }
    
    func getPlaylist(id: String) async throws -> ProviderPlaylist {
        let body = YTMGetPlaylistRequest(playlistId: id)
        let response: YTMGetPlaylistResponse = try await performRequest(endpoint: "browse", body: body)
        return parsePlaylist(response)
    }
    
    func getUserPlaylists() async throws -> [ProviderPlaylist] {
        let body = YTMGetLibraryPlaylistsRequest()
        let response: YTMGetLibraryPlaylistsResponse = try await performRequest(endpoint: "browse", body: body)
        return response.playlists.map(parsePlaylist)
    }
    
    func getUserLibrary() async throws -> UserLibrary {
        let body = YTMGetLibraryRequest()
        let response: YTMGetLibraryResponse = try await performRequest(endpoint: "browse", body: body)
        return parseUserLibrary(response)
    }
    
    func getRecommendations(basedOn: [String], limit: Int) async throws -> [Track] {
        let body = YTMGetRecommendationsRequest(seedIds: basedOn, limit: limit)
        let response: YTMGetRecommendationsResponse = try await performRequest(endpoint: "music/get_recommendations", body: body)
        return response.tracks.map { parseTrack($0, quality: .high) }
    }
    
    func getCharts() async throws -> Charts {
        let body = YTMGetChartsRequest()
        let response: YTMGetChartsResponse = try await performRequest(endpoint: "browse", body: body)
        return parseCharts(response)
    }
    
    func getNewReleases() async throws -> [Album] {
        let body = YTMGetNewReleasesRequest()
        let response: YTMGetNewReleasesResponse = try await performRequest(endpoint: "browse", body: body)
        return response.albums.map(parseAlbum)
    }
    
    func getStreamURL(for track: Track, quality: AudioQuality) async throws -> URL {
        let body = YTMGetStreamRequest(videoId: track.providerID, quality: quality)
        let response: YTMGetStreamResponse = try await performRequest(endpoint: "music/get_stream", body: body)
        guard let urlString = response.streamUrl, let url = URL(string: urlString) else {
            throw ProviderError.noStreamURL
        }
        return url
    }
    
    func getLyrics(for track: Track) async throws -> Lyrics? {
        let body = YTMGetLyricsRequest(videoId: track.providerID)
        let response: YTMGetLyricsResponse = try await performRequest(endpoint: "music/get_lyrics", body: body)
        return parseLyrics(response)
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
    
    private func performRequest<T: Decodable>(endpoint: String, body: some Encodable) async throws -> T {
        var request = URLRequest(url: URL(string: "\(baseURL)/\(endpoint)")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("gzip", forHTTPHeaderField: "Accept-Encoding")
        request.httpBody = try JSONEncoder().encode(body)
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ProviderError.invalidResponse
        }
        
        if httpResponse.statusCode == 401 {
            throw ProviderError.unauthorized
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw ProviderError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(T.self, from: data)
    }
    
    private func parseSearchResults(_ response: YTMSearchResponse) -> SearchResults {
        var tracks: [Track] = []
        var albums: [Album] = []
        var artists: [Artist] = []
        var playlists: [ProviderPlaylist] = []
        var videos: [Video] = []
        
        for item in response.contents {
            switch item.type {
            case "track": tracks.append(parseTrack(item.track!, quality: .high))
            case "album": albums.append(parseAlbum(item.album!))
            case "artist": artists.append(parseArtist(item.artist!))
            case "playlist": playlists.append(parsePlaylist(item.playlist!))
            case "video": videos.append(parseVideo(item.video!))
            default: break
            }
        }
        
        return SearchResults(tracks: tracks, albums: albums, artists: artists, playlists: playlists, videos: videos)
    }
    
    private func parseTrack(_ ytmTrack: YTMTrack, quality: AudioQuality) -> Track {
        Track(
            id: ytmTrack.videoId,
            title: ytmTrack.title,
            artist: ytmTrack.artists.first?.name ?? "Unknown",
            provider: .youtubeMusic,
            providerID: ytmTrack.videoId,
            duration: TimeInterval(ytmTrack.durationSeconds ?? 0)
        )
    }
    
    private func parseAlbum(_ ytmAlbum: YTMAlbum) -> Album {
        Album(
            id: ytmAlbum.browseId,
            title: ytmAlbum.title,
            artist: ytmAlbum.artist?.name ?? "Unknown",
            artistId: ytmAlbum.artist?.browseId ?? "",
            artworkURL: ytmAlbum.thumbnails.last?.url,
            releaseDate: ytmAlbum.year.flatMap { DateComponents(year: $0).date },
            trackCount: ytmAlbum.trackCount ?? 0,
            duration: TimeInterval(ytmAlbum.durationSeconds ?? 0),
            provider: .youtubeMusic,
            providerID: ytmAlbum.browseId,
            isExplicit: ytmAlbum.isExplicit ?? false,
            genres: ytmAlbum.genres ?? [],
            copyright: ytmAlbum.copyright
        )
    }
    
    private func parseArtist(_ ytmArtist: YTMArtist) -> Artist {
        Artist(
            id: ytmArtist.browseId,
            name: ytmArtist.name,
            artworkURL: ytmArtist.thumbnails.last?.url,
            biography: ytmArtist.description,
            genres: ytmArtist.genres ?? [],
            provider: .youtubeMusic,
            providerID: ytmArtist.browseId,
            monthlyListeners: ytmArtist.monthlyListeners
        )
    }
    
    private func parsePlaylist(_ ytmPlaylist: YTMPlaylist) -> ProviderPlaylist {
        Playlist(
            id: ytmPlaylist.playlistId,
            name: ytmPlaylist.title,
            description: ytmPlaylist.description,
            artworkURL: ytmPlaylist.thumbnails.last?.url,
            trackCount: ytmPlaylist.trackCount ?? 0,
            duration: TimeInterval(ytmPlaylist.durationSeconds ?? 0),
            owner: ytmPlaylist.owner?.name ?? "Unknown",
            ownerId: ytmPlaylist.owner?.browseId ?? "",
            isPublic: ytmPlaylist.isPublic ?? false,
            isCollaborative: ytmPlaylist.isCollaborative ?? false,
            provider: .youtubeMusic,
            providerID: ytmPlaylist.playlistId,
            createdAt: ytmPlaylist.createdAt ?? Date(),
            updatedAt: ytmPlaylist.updatedAt ?? Date()
        )
    }
    
    private func parseVideo(_ ytmVideo: YTMVideo) -> Video {
        Video(
            id: ytmVideo.videoId,
            title: ytmVideo.title,
            artist: ytmVideo.artists.first?.name ?? "Unknown",
            thumbnailURL: ytmVideo.thumbnails.last?.url,
            duration: TimeInterval(ytmVideo.durationSeconds ?? 0),
            viewCount: ytmVideo.viewCount ?? 0,
            provider: .youtubeMusic,
            providerID: ytmVideo.videoId
        )
    }
    
    private func parseCharts(_ response: YTMGetChartsResponse) -> Charts {
        Charts(
            topTracks: response.topTracks.map { parseTrack($0, quality: .high) },
            topAlbums: response.topAlbums.map(parseAlbum),
            topArtists: response.topArtists.map(parseArtist),
            topPlaylists: response.topPlaylists.map(parsePlaylist),
            trending: response.trending.map { parseTrack($0, quality: .high) }
        )
    }
    
    private func parseUserLibrary(_ response: YTMGetLibraryResponse) -> UserLibrary {
        UserLibrary(
            tracks: response.tracks.map { parseTrack($0, quality: .high) },
            albums: response.albums.map(parseAlbum),
            artists: response.artists.map(parseArtist),
            playlists: response.playlists.map(parsePlaylist)
        )
    }
    
    private func parseLyrics(_ response: YTMGetLyricsResponse) -> Lyrics? {
        guard let lyrics = response.lyrics else { return nil }
        return Lyrics(
            text: lyrics.content,
            syncData: lyrics.lines.map { LyricLine(time: $0.time, text: $0.text) },
            language: lyrics.language,
            provider: .youtubeMusic
        )
    }
}

struct YTMSearchRequest: Encodable {
    let query: String
    let params: String
    let musicTypes: [String]
}

struct YTMSearchResponse: Decodable {
    let contents: [YTMSearchItem]
}

struct YTMSearchItem: Decodable {
    let type: String
    let track: YTMTrack?
    let album: YTMAlbum?
    let artist: YTMArtist?
    let playlist: YTMPlaylist?
    let video: YTMVideo?
}

struct YTMTrack: Decodable {
    let videoId: String
    let title: String
    let artists: [YTMArtistBrief]
    let durationSeconds: Int?
    let thumbnails: [YTMThumbnail]
    let album: YTMAlbumBrief?
}

struct YTMAlbum: Decodable {
    let browseId: String
    let title: String
    let artist: YTMArtistBrief?
    let thumbnails: [YTMThumbnail]
    let year: Int?
    let trackCount: Int?
    let durationSeconds: Int?
    let isExplicit: Bool?
    let genres: [String]?
    let copyright: String?
}

struct YTMArtist: Decodable {
    let browseId: String
    let name: String
    let thumbnails: [YTMThumbnail]
    let description: String?
    let genres: [String]?
    let monthlyListeners: Int?
}

struct YTMPlaylist: Decodable {
    let playlistId: String
    let title: String
    let description: String?
    let thumbnails: [YTMThumbnail]
    let trackCount: Int?
    let durationSeconds: Int?
    let owner: YTMArtistBrief?
    let isPublic: Bool?
    let isCollaborative: Bool?
    let createdAt: Date?
    let updatedAt: Date?
}

struct YTMVideo: Decodable {
    let videoId: String
    let title: String
    let artists: [YTMArtistBrief]
    let thumbnails: [YTMThumbnail]
    let durationSeconds: Int?
    let viewCount: Int?
}

struct YTMArtistBrief: Decodable {
    let name: String
    let browseId: String?
}

struct YTMAlbumBrief: Decodable {
    let name: String
    let browseId: String?
}

struct YTMThumbnail: Decodable {
    let url: String
    let width: Int?
    let height: Int?
}

struct YTMGetTrackRequest: Encodable {
    let videoId: String
}

struct YTMGetTrackResponse: Decodable {
    let track: YTMTrack
}

struct YTMGetAlbumRequest: Encodable {
    let browseId: String
}

struct YTMGetAlbumResponse: Decodable {
    let album: YTMAlbum
    let tracks: [YTMTrack]
}

struct YTMGetArtistRequest: Encodable {
    let browseId: String
}

struct YTMGetArtistResponse: Decodable {
    let artist: YTMArtist
    let topTracks: [YTMTrack]
    let albums: [YTMAlbum]
}

struct YTMGetPlaylistRequest: Encodable {
    let playlistId: String
}

struct YTMGetPlaylistResponse: Decodable {
    let playlist: YTMPlaylist
    let tracks: [YTMTrack]
}

struct YTMGetLibraryPlaylistsRequest: Encodable {}

struct YTMGetLibraryPlaylistsResponse: Decodable {
    let playlists: [YTMPlaylist]
}

struct YTMGetLibraryRequest: Encodable {}

struct YTMGetLibraryResponse: Decodable {
    let tracks: [YTMTrack]
    let albums: [YTMAlbum]
    let artists: [YTMArtist]
    let playlists: [YTMPlaylist]
}

struct YTMGetRecommendationsRequest: Encodable {
    let seedIds: [String]
    let limit: Int
}

struct YTMGetRecommendationsResponse: Decodable {
    let tracks: [YTMTrack]
}

struct YTMGetChartsRequest: Encodable {}

struct YTMGetChartsResponse: Decodable {
    let topTracks: [YTMTrack]
    let topAlbums: [YTMAlbum]
    let topArtists: [YTMArtist]
    let topPlaylists: [YTMPlaylist]
    let trending: [YTMTrack]
}

struct YTMGetNewReleasesRequest: Encodable {}

struct YTMGetNewReleasesResponse: Decodable {
    let albums: [YTMAlbum]
}

struct YTMGetStreamRequest: Encodable {
    let videoId: String
    let quality: AudioQuality
}

struct YTMGetStreamResponse: Decodable {
    let streamUrl: String?
}

struct YTMGetLyricsRequest: Encodable {
    let videoId: String
}

struct YTMGetLyricsResponse: Decodable {
    let lyrics: YTMLyrics?
}

struct YTMLyrics: Decodable {
    let content: String
    let lines: [YTMLyricLine]
    let language: String?
}

struct YTMLyricLine: Decodable {
    let time: TimeInterval
    let text: String
}

enum ProviderError: Error, LocalizedError {
    case authenticationRequired(String)
    case unauthorized
    case invalidResponse
    case httpError(Int)
    case noStreamURL
    case notImplemented
    case decodingError(Error)
    
    var errorDescription: String? {
        switch self {
        case .authenticationRequired(let url): return "Authentication required: \(url)"
        case .unauthorized: return "Unauthorized - please log in again"
        case .invalidResponse: return "Invalid response from server"
        case .httpError(let code): return "HTTP error: \(code)"
        case .noStreamURL: return "No stream URL available"
        case .notImplemented: return "Feature not implemented"
        case .decodingError(let error): return "Decoding error: \(error.localizedDescription)"
        }
    }
}