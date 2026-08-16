import Foundation
import CryptoKit

struct QobuzProvider: MusicService {
    let providerType: MusicProviderType = .qobuz
    let displayName: String = "Qobuz"
    let iconName: String = "waveform"
    let supportedQualities: [AudioQuality] = [.standard, .high, .lossless, .hires]
    
    private let baseURL = "https://www.qobuz.com/api.json/0.2"
    private let appId = "YOUR_QOBUZ_APP_ID"
    private let appSecret = "YOUR_QOBUZ_APP_SECRET"
    private var userAuthToken: String?
    private var refreshToken: String?
    
    func authenticate() async throws -> ProviderAuthResult {
        let authURL = "https://www.qobuz.com/api.json/0.2/user/login?app_id=\(appId)&username=USERNAME&password=PASSWORD"
        throw ProviderError.authenticationRequired(authURL)
    }
    
    func refreshToken() async throws -> String {
        guard let refreshToken = refreshToken else { throw ProviderError.unauthorized }
        let params = ["app_id": appId, "refresh_token": refreshToken]
        let response: QobuzRefreshResponse = try await performRequest(endpoint: "user/refreshToken", params: params)
        userAuthToken = response.userAuthToken
        return response.userAuthToken
    }
    
    func signOut() async throws {
        userAuthToken = nil
        refreshToken = nil
    }
    
    func search(query: String, types: [SearchType], limit: Int, offset: Int) async throws -> SearchResults {
        var params = ["query": query, "limit": String(limit), "offset": String(offset)]
        let response: QobuzSearchResponse = try await performRequest(endpoint: "track/search", params: params)
        
        let tracks = response.tracks.items.map(parseTrack)
        let albums = response.albums.items.map(parseAlbum)
        let artists = response.artists.items.map(parseArtist)
        let playlists = response.playlists.items.map(parsePlaylist)
        
        return SearchResults(tracks: tracks, albums: albums, artists: artists, playlists: playlists, videos: [])
    }
    
    func getTrack(id: String, quality: AudioQuality) async throws -> Track {
        let params = ["track_id": id]
        let response: QobuzTrackResponse = try await performRequest(endpoint: "track/get", params: params)
        return parseTrack(response.track)
    }
    
    func getAlbum(id: String) async throws -> Album {
        let params = ["album_id": id]
        let response: QobuzAlbumResponse = try await performRequest(endpoint: "album/get", params: params)
        return parseAlbum(response.album)
    }
    
    func getArtist(id: String) async throws -> Artist {
        let params = ["artist_id": id]
        let response: QobuzArtistResponse = try await performRequest(endpoint: "artist/get", params: params)
        return parseArtist(response.artist)
    }
    
    func getPlaylist(id: String) async throws -> ProviderPlaylist {
        let params = ["playlist_id": id]
        let response: QobuzPlaylistResponse = try await performRequest(endpoint: "playlist/get", params: params)
        return parsePlaylist(response.playlist)
    }
    
    func getUserPlaylists() async throws -> [ProviderPlaylist] {
        let params = ["user_id": "me"]
        let response: QobuzUserPlaylistsResponse = try await performRequest(endpoint: "playlist/getUserPlaylists", params: params)
        return response.playlists.items.map(parsePlaylist)
    }
    
    func getUserLibrary() async throws -> UserLibrary {
        let params = ["user_id": "me"]
        async let tracksResponse: QobuzUserTracksResponse = performRequest(endpoint: "track/getUserTracks", params: params)
        async let albumsResponse: QobuzUserAlbumsResponse = performRequest(endpoint: "album/getUserAlbums", params: params)
        async let playlistsResponse: QobuzUserPlaylistsResponse = performRequest(endpoint: "playlist/getUserPlaylists", params: params)
        
        let (tracks, albums, playlists) = try await (tracksResponse, albumsResponse, playlistsResponse)
        return UserLibrary(
            tracks: tracks.tracks.items.map(parseTrack),
            albums: albums.albums.items.map(parseAlbum),
            artists: [],
            playlists: playlists.playlists.items.map(parsePlaylist)
        )
    }
    
    func getRecommendations(basedOn: [String], limit: Int) async throws -> [Track] {
        let params = ["track_ids": basedOn.joined(separator: ","), "limit": String(limit)]
        let response: QobuzRecommendationsResponse = try await performRequest(endpoint: "track/getSimilar", params: params)
        return response.tracks.items.map(parseTrack)
    }
    
    func getCharts() async throws -> Charts {
        let response: QobuzChartsResponse = try await performRequest(endpoint: "chart/get", params: [:])
        return Charts(
            topTracks: response.tracks.items.map(parseTrack),
            topAlbums: response.albums.items.map(parseAlbum),
            topArtists: response.artists.items.map(parseArtist),
            topPlaylists: [],
            trending: response.tracks.items.map(parseTrack)
        )
    }
    
    func getNewReleases() async throws -> [Album] {
        let response: QobuzNewReleasesResponse = try await performRequest(endpoint: "album/getNewReleases", params: [:])
        return response.albums.items.map(parseAlbum)
    }
    
    func getStreamURL(for track: Track, quality: AudioQuality) async throws -> URL {
        let formatId = qualityToFormatId(quality)
        let params = ["track_id": track.providerID, "format_id": formatId, "intent": "stream"]
        let response: QobuzStreamResponse = try await performRequest(endpoint: "track/getFileUrl", params: params)
        guard let urlString = response.url, let url = URL(string: urlString) else {
            throw ProviderError.noStreamURL
        }
        return url
    }
    
    func getLyrics(for track: Track) async throws -> Lyrics? {
        let params = ["track_id": track.providerID]
        let response: QobuzLyricsResponse = try await performRequest(endpoint: "track/getLyrics", params: params)
        guard let lyrics = response.lyrics else { return nil }
        return Lyrics(
            text: lyrics.text,
            syncData: lyrics.syncedLyrics?.map { LyricLine(time: $0.time, text: $0.text) },
            language: lyrics.language,
            provider: .qobuz
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
        components.queryItems?.append(URLQueryItem(name: "app_id", value: appId))
        
        if let token = userAuthToken {
            components.queryItems?.append(URLQueryItem(name: "user_auth_token", value: token))
        }
        
        var request = URLRequest(url: components.url!)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
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
    
    private func qualityToFormatId(_ quality: AudioQuality) -> String {
        switch quality {
        case .low, .standard: return "5"    // MP3 320
        case .high: return "6"               // FLAC 16-bit
        case .lossless: return "7"           // FLAC 24-bit <= 96kHz
        case .hires: return "27"             // FLAC 24-bit > 96kHz
        }
    }
    
    private func parseTrack(_ qTrack: QobuzTrack) -> Track {
        Track(
            id: String(qTrack.id),
            title: qTrack.title,
            artist: qTrack.performer.name,
            provider: .qobuz,
            providerID: String(qTrack.id),
            duration: TimeInterval(qTrack.duration)
        )
    }
    
    private func parseAlbum(_ qAlbum: QobuzAlbum) -> Album {
        Album(
            id: String(qAlbum.id),
            title: qAlbum.title,
            artist: qAlbum.artist.name,
            artistId: String(qAlbum.artist.id),
            artworkURL: qAlbum.image.large,
            releaseDate: qAlbum.releasedAt.flatMap { ISO8601DateFormatter().date(from: $0) },
            trackCount: qAlbum.tracksCount,
            duration: TimeInterval(qAlbum.duration),
            provider: .qobuz,
            providerID: String(qAlbum.id),
            isExplicit: qAlbum.explicit,
            genres: qAlbum.genres.map { $0.name },
            copyright: qAlbum.copyright
        )
    }
    
    private func parseArtist(_ qArtist: QobuzArtist) -> Artist {
        Artist(
            id: String(qArtist.id),
            name: qArtist.name,
            artworkURL: qArtist.image.large,
            biography: qArtist.biography,
            genres: qArtist.genres.map { $0.name },
            provider: .qobuz,
            providerID: String(qArtist.id),
            monthlyListeners: nil
        )
    }
    
    private func parsePlaylist(_ qPlaylist: QobuzPlaylist) -> ProviderPlaylist {
        Playlist(
            id: String(qPlaylist.id),
            name: qPlaylist.name,
            description: qPlaylist.description,
            artworkURL: qPlaylist.image.large,
            trackCount: qPlaylist.tracksCount,
            duration: TimeInterval(qPlaylist.duration),
            owner: qPlaylist.owner.name,
            ownerId: String(qPlaylist.owner.id),
            isPublic: qPlaylist.isPublic,
            isCollaborative: qPlaylist.isCollaborative,
            provider: .qobuz,
            providerID: String(qPlaylist.id),
            createdAt: qPlaylist.createdAt.flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date(),
            updatedAt: qPlaylist.updatedAt.flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date()
        )
    }
}

struct QobuzTrack: Decodable {
    let id: Int
    let title: String
    let performer: QobuzPerformer
    let duration: Int
    let image: QobuzImage
    let album: QobuzAlbumBrief?
}

struct QobuzAlbum: Decodable {
    let id: Int
    let title: String
    let artist: QobuzPerformer
    let image: QobuzImage
    let releasedAt: String?
    let tracksCount: Int
    let duration: Int
    let explicit: Bool
    let genres: [QobuzGenre]
    let copyright: String?
}

struct QobuzArtist: Decodable {
    let id: Int
    let name: String
    let image: QobuzImage
    let biography: String?
    let genres: [QobuzGenre]
}

struct QobuzPlaylist: Decodable {
    let id: Int
    let name: String
    let description: String?
    let image: QobuzImage
    let tracksCount: Int
    let duration: Int
    let owner: QobuzPerformer
    let isPublic: Bool
    let isCollaborative: Bool
    let createdAt: String?
    let updatedAt: String?
}

struct QobuzPerformer: Decodable {
    let id: Int
    let name: String
}

struct QobuzImage: Decodable {
    let small: String?
    let large: String?
    let xlarge: String?
}

struct QobuzGenre: Decodable {
    let name: String
}

struct QobuzAlbumBrief: Decodable {
    let id: Int
    let title: String
}

struct QobuzSearchResponse: Decodable {
    let tracks: QobuzPaginated<QobuzTrack>
    let albums: QobuzPaginated<QobuzAlbum>
    let artists: QobuzPaginated<QobuzArtist>
    let playlists: QobuzPaginated<QobuzPlaylist>
}

struct QobuzTrackResponse: Decodable {
    let track: QobuzTrack
}

struct QobuzAlbumResponse: Decodable {
    let album: QobuzAlbum
}

struct QobuzArtistResponse: Decodable {
    let artist: QobuzArtist
}

struct QobuzPlaylistResponse: Decodable {
    let playlist: QobuzPlaylist
}

struct QobuzUserPlaylistsResponse: Decodable {
    let playlists: QobuzPaginated<QobuzPlaylist>
}

struct QobuzUserTracksResponse: Decodable {
    let tracks: QobuzPaginated<QobuzTrack>
}

struct QobuzUserAlbumsResponse: Decodable {
    let albums: QobuzPaginated<QobuzAlbum>
}

struct QobuzRecommendationsResponse: Decodable {
    let tracks: QobuzPaginated<QobuzTrack>
}

struct QobuzChartsResponse: Decodable {
    let tracks: QobuzPaginated<QobuzTrack>
    let albums: QobuzPaginated<QobuzAlbum>
    let artists: QobuzPaginated<QobuzArtist>
}

struct QobuzNewReleasesResponse: Decodable {
    let albums: QobuzPaginated<QobuzAlbum>
}

struct QobuzStreamResponse: Decodable {
    let url: String?
    let formatId: Int
}

struct QobuzLyricsResponse: Decodable {
    let lyrics: QobuzLyrics?
}

struct QobuzLyrics: Decodable {
    let text: String
    let syncedLyrics: [QobuzSyncedLyric]?
    let language: String?
}

struct QobuzSyncedLyric: Decodable {
    let time: TimeInterval
    let text: String
}

struct QobuzRefreshResponse: Decodable {
    let userAuthToken: String
}

struct QobuzPaginated<T: Decodable>: Decodable {
    let items: [T]
    let total: Int
    let limit: Int
    let offset: Int
}