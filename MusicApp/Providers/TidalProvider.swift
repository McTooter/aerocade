import Foundation
import CryptoKit

final class TidalProvider: MusicService, @unchecked Sendable {
    let providerType: MusicProviderType = .tidal
    let displayName: String = "Tidal"
    let iconName: String = "water.waves"
    let supportedQualities: [AudioQuality] = [.standard, .high, .lossless, .hires]
    
    private let baseURL = "https://api.tidal.com/v1"
    private let clientId = "YOUR_TIDAL_CLIENT_ID"
    private let clientSecret = "YOUR_TIDAL_CLIENT_SECRET"
    private var accessToken: String?
    private var refreshToken: String?
    private var tokenExpiresAt: Date?
    
    func authenticate() async throws -> ProviderAuthResult {
        let authURL = "https://auth.tidal.com/v1/oauth2/authorize?client_id=\(clientId)&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=user.read+playback.read+playback.modify"
        throw ProviderError.authenticationRequired(authURL)
    }
    
    func refreshToken() async throws -> String {
        guard let refreshToken = refreshToken else { throw ProviderError.unauthorized }
        
        var components = URLComponents(string: "https://auth.tidal.com/v1/oauth2/token")!
        components.queryItems = [
            URLQueryItem(name: "grant_type", value: "refresh_token"),
            URLQueryItem(name: "refresh_token", value: refreshToken),
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "client_secret", value: clientSecret)
        ]
        
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw ProviderError.unauthorized
        }
        
        let tokenResponse = try JSONDecoder().decode(TidalTokenResponse.self, from: data)
        accessToken = tokenResponse.accessToken
        self.refreshToken = tokenResponse.refreshToken
        tokenExpiresAt = Date().addingTimeInterval(TimeInterval(tokenResponse.expiresIn))
        
        return tokenResponse.accessToken
    }
    
    func signOut() async throws {
        accessToken = nil
        refreshToken = nil
        tokenExpiresAt = nil
    }
    
    func search(query: String, types: [SearchType], limit: Int, offset: Int) async throws -> SearchResults {
        var params = [
            "query": query,
            "limit": String(limit),
            "offset": String(offset),
            "types": types.map { $0.rawValue }.joined(separator: ",")
        ]
        
        let response: TidalSearchResponse = try await performRequest(endpoint: "search", params: params)
        
        let tracks = response.tracks?.items.map(parseTrack) ?? []
        let albums = response.albums?.items.map(parseAlbum) ?? []
        let artists = response.artists?.items.map(parseArtist) ?? []
        let playlists = response.playlists?.items.map(parsePlaylist) ?? []
        let videos = response.videos?.items.map(parseVideo) ?? []
        
        return SearchResults(tracks: tracks, albums: albums, artists: artists, playlists: playlists, videos: videos)
    }
    
    func getTrack(id: String, quality: AudioQuality) async throws -> Track {
        let params = ["track_id": id]
        let response: TidalTrackResponse = try await performRequest(endpoint: "tracks/\(id)", params: params)
        return parseTrack(response.track)
    }
    
    func getAlbum(id: String) async throws -> Album {
        let response: TidalAlbumResponse = try await performRequest(endpoint: "albums/\(id)", params: [:])
        return parseAlbum(response.album)
    }
    
    func getArtist(id: String) async throws -> Artist {
        let response: TidalArtistResponse = try await performRequest(endpoint: "artists/\(id)", params: [:])
        return parseArtist(response.artist)
    }
    
    func getPlaylist(id: String) async throws -> ProviderPlaylist {
        let response: TidalPlaylistResponse = try await performRequest(endpoint: "playlists/\(id)", params: [:])
        return parsePlaylist(response.playlist)
    }
    
    func getUserPlaylists() async throws -> [ProviderPlaylist] {
        let response: TidalUserPlaylistsResponse = try await performRequest(endpoint: "playlists", params: ["user_id": "me"])
        return response.items.map(parsePlaylist)
    }
    
    func getUserLibrary() async throws -> UserLibrary {
        async let tracksResponse: TidalUserTracksResponse = performRequest(endpoint: "tracks", params: ["user_id": "me"])
        async let albumsResponse: TidalUserAlbumsResponse = performRequest(endpoint: "albums", params: ["user_id": "me"])
        async let playlistsResponse: TidalUserPlaylistsResponse = performRequest(endpoint: "playlists", params: ["user_id": "me"])
        
        let (tracks, albums, playlists) = try await (tracksResponse, albumsResponse, playlistsResponse)
        return UserLibrary(
            tracks: tracks.items.map(parseTrack),
            albums: albums.items.map(parseAlbum),
            artists: [],
            playlists: playlists.items.map(parsePlaylist)
        )
    }
    
    func getRecommendations(basedOn: [String], limit: Int) async throws -> [Track] {
        let params = ["track_ids": basedOn.joined(separator: ","), "limit": String(limit)]
        let response: TidalRecommendationsResponse = try await performRequest(endpoint: "recommendations/tracks", params: params)
        return response.items.map(parseTrack)
    }
    
    func getCharts() async throws -> Charts {
        let response: TidalChartsResponse = try await performRequest(endpoint: "charts", params: [:])
        return Charts(
            topTracks: response.tracks.items.map(parseTrack),
            topAlbums: response.albums.items.map(parseAlbum),
            topArtists: response.artists.items.map(parseArtist),
            topPlaylists: response.playlists.items.map(parsePlaylist),
            trending: response.tracks.items.map(parseTrack)
        )
    }
    
    func getNewReleases() async throws -> [Album] {
        let response: TidalNewReleasesResponse = try await performRequest(endpoint: "new-releases", params: [:])
        return response.albums.items.map(parseAlbum)
    }
    
    func getStreamURL(for track: Track, quality: AudioQuality) async throws -> URL {
        let params = [
            "track_id": track.providerID,
            "sound_quality": qualityToSoundQuality(quality),
            "playback_mode": "STREAM"
        ]
        let response: TidalStreamResponse = try await performRequest(endpoint: "tracks/\(track.providerID)/playback", params: params)
        guard let urlString = response.asset.url, let url = URL(string: urlString) else {
            throw ProviderError.noStreamURL
        }
        return url
    }
    
    func getLyrics(for track: Track) async throws -> Lyrics? {
        let response: TidalLyricsResponse = try await performRequest(endpoint: "tracks/\(track.providerID)/lyrics", params: [:])
        guard let lyrics = response.lyrics else { return nil }
        return Lyrics(
            text: lyrics.subtitle,
            syncData: lyrics.lines.map { LyricLine(time: $0.time, text: $0.text) },
            language: lyrics.language,
            provider: .tidal
        )
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
    
    private func performRequest<T: Decodable>(endpoint: String, params: [String: String]) async throws -> T {
        var components = URLComponents(string: "\(baseURL)/\(endpoint)")!
        components.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
        components.queryItems?.append(URLQueryItem(name: "countryCode", value: Locale.current.region?.identifier ?? "US"))
        
        var request = URLRequest(url: components.url!)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ProviderError.invalidResponse
        }
        
        if httpResponse.statusCode == 401 {
            _ = try await refreshToken()
            return try await performRequest(endpoint: endpoint, params: params)
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw ProviderError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(T.self, from: data)
    }
    
    private func qualityToSoundQuality(_ quality: AudioQuality) -> String {
        switch quality {
        case .low, .standard: return "LOW"
        case .high: return "HIGH"
        case .lossless: return "LOSSLESS"
        case .hires: return "HI_RES"
        }
    }
    
    private func parseTrack(_ tTrack: TidalTrack) -> Track {
        Track(
            id: String(tTrack.id),
            title: tTrack.title,
            artist: tTrack.artist.name,
            provider: .tidal,
            providerID: String(tTrack.id),
            duration: TimeInterval(tTrack.duration)
        )
    }
    
    private func parseAlbum(_ tAlbum: TidalAlbum) -> Album {
        Album(
            id: String(tAlbum.id),
            title: tAlbum.title,
            artist: tAlbum.artist.name,
            artistId: String(tAlbum.artist.id),
            artworkURL: tAlbum.cover?.replacingOccurrences(of: "-", with: "800x800"),
            releaseDate: tAlbum.releaseDate.flatMap { ISO8601DateFormatter().date(from: $0) },
            trackCount: tAlbum.numberOfTracks,
            duration: TimeInterval(tAlbum.duration),
            provider: .tidal,
            providerID: String(tAlbum.id),
            isExplicit: tAlbum.explicit,
            genres: tAlbum.genres?.map { $0.name } ?? [],
            copyright: tAlbum.copyright
        )
    }
    
    private func parseArtist(_ tArtist: TidalArtist) -> Artist {
        Artist(
            id: String(tArtist.id),
            name: tArtist.name,
            artworkURL: tArtist.picture?.replacingOccurrences(of: "-", with: "800x800"),
            biography: tArtist.biography,
            genres: tArtist.genres?.map { $0.name } ?? [],
            provider: .tidal,
            providerID: String(tArtist.id),
            monthlyListeners: nil
        )
    }
    
    private func parsePlaylist(_ tPlaylist: TidalPlaylist) -> ProviderPlaylist {
        ProviderPlaylist(
            id: String(tPlaylist.id),
            name: tPlaylist.title,
            description: tPlaylist.description,
            artworkURL: tPlaylist.cover?.replacingOccurrences(of: "-", with: "800x800"),
            trackCount: tPlaylist.numberOfTracks,
            duration: TimeInterval(tPlaylist.duration),
            owner: tPlaylist.creator.name,
            ownerId: String(tPlaylist.creator.id),
            isPublic: tPlaylist.isPublic,
            isCollaborative: tPlaylist.isCollaborative,
            provider: .tidal,
            providerID: String(tPlaylist.id),
            createdAt: tPlaylist.created.flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date(),
            updatedAt: tPlaylist.updated.flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date()
        )
    }
    
    private func parseVideo(_ tVideo: TidalVideo) -> Video {
        Video(
            id: String(tVideo.id),
            title: tVideo.title,
            artist: tVideo.artist.name,
            thumbnailURL: tVideo.cover?.replacingOccurrences(of: "-", with: "800x800"),
            duration: TimeInterval(tVideo.duration),
            viewCount: 0,
            provider: .tidal,
            providerID: String(tVideo.id)
        )
    }
}

struct TidalTrack: Decodable {
    let id: Int
    let title: String
    let artist: TidalArtistBrief
    let duration: Int
    let album: TidalAlbumBrief?
    let explicit: Bool
    let trackNumber: Int
    let volumeNumber: Int
    let copyright: String?
    let isrc: String?
    let audioQuality: String
    let audioModes: [String]
}

struct TidalAlbum: Decodable {
    let id: Int
    let title: String
    let artist: TidalArtistBrief
    let cover: String?
    let releaseDate: String?
    let numberOfTracks: Int
    let duration: Int
    let explicit: Bool
    let genres: [TidalGenre]?
    let copyright: String?
    let type: String
    let version: String?
    let vibe: String?
}

struct TidalArtist: Decodable {
    let id: Int
    let name: String
    let picture: String?
    let biography: String?
    let genres: [TidalGenre]?
    let type: String
}

struct TidalPlaylist: Decodable {
    let id: Int
    let title: String
    let description: String?
    let cover: String?
    let numberOfTracks: Int
    let duration: Int
    let creator: TidalUser
    let isPublic: Bool
    let isCollaborative: Bool
    let created: String?
    let updated: String?
}

struct TidalVideo: Decodable {
    let id: Int
    let title: String
    let artist: TidalArtistBrief
    let cover: String?
    let duration: Int
    let explicit: Bool
}

struct TidalArtistBrief: Decodable {
    let id: Int
    let name: String
}

struct TidalAlbumBrief: Decodable {
    let id: Int
    let title: String
}

struct TidalUser: Decodable {
    let id: Int
    let name: String
}

struct TidalGenre: Decodable {
    let id: Int
    let name: String
}

struct TidalSearchResponse: Decodable {
    let tracks: TidalPaginated<TidalTrack>?
    let albums: TidalPaginated<TidalAlbum>?
    let artists: TidalPaginated<TidalArtist>?
    let playlists: TidalPaginated<TidalPlaylist>?
    let videos: TidalPaginated<TidalVideo>?
}

struct TidalTrackResponse: Decodable {
    let track: TidalTrack
}

struct TidalAlbumResponse: Decodable {
    let album: TidalAlbum
}

struct TidalArtistResponse: Decodable {
    let artist: TidalArtist
}

struct TidalPlaylistResponse: Decodable {
    let playlist: TidalPlaylist
}

struct TidalUserPlaylistsResponse: Decodable {
    let items: [TidalPlaylist]
    let totalNumberOfItems: Int
    let limit: Int
    let offset: Int
}

struct TidalUserTracksResponse: Decodable {
    let items: [TidalTrack]
    let totalNumberOfItems: Int
}

struct TidalUserAlbumsResponse: Decodable {
    let items: [TidalAlbum]
    let totalNumberOfItems: Int
}

struct TidalRecommendationsResponse: Decodable {
    let items: [TidalTrack]
}

struct TidalChartsResponse: Decodable {
    let tracks: TidalPaginated<TidalTrack>
    let albums: TidalPaginated<TidalAlbum>
    let artists: TidalPaginated<TidalArtist>
    let playlists: TidalPaginated<TidalPlaylist>
}

struct TidalNewReleasesResponse: Decodable {
    let albums: TidalPaginated<TidalAlbum>
}

struct TidalStreamResponse: Decodable {
    let asset: TidalStreamAsset
}

struct TidalStreamAsset: Decodable {
    let url: String?
    let itemId: Int
    let assetPresentation: String
    let audioQuality: String
    let audioModes: [String]
    let manifestMimeType: String
    let manifestUrl: String?
}

struct TidalLyricsResponse: Decodable {
    let lyrics: TidalLyrics?
}

struct TidalLyrics: Decodable {
    let subtitle: String
    let lines: [TidalLyricLine]
    let language: String?
}

struct TidalLyricLine: Decodable {
    let time: TimeInterval
    let text: String
}

struct TidalTokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let tokenType: String
}

struct TidalPaginated<T: Decodable>: Decodable {
    let items: [T]
    let totalNumberOfItems: Int
    let limit: Int
    let offset: Int
}