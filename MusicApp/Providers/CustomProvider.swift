import Foundation
import CryptoKit

final class CustomProvider: MusicService, @unchecked Sendable {
    let providerType: MusicProviderType = .custom
    let displayName: String = "Custom"
    let iconName: String = "gear"
    let supportedQualities: [AudioQuality] = [.low, .standard, .high, .lossless, .hires]
    
    private let baseURL: String
    private var apiKey: String?
    private var accessToken: String?
    
    init(baseURL: String = "https://api.yourservice.com", apiKey: String? = nil) {
        self.baseURL = baseURL
        self.apiKey = apiKey
    }
    
    func authenticate() async throws -> ProviderAuthResult {
        guard let apiKey = apiKey else {
            throw ProviderError.authenticationRequired("\(baseURL)/auth")
        }
        
        let body = ["apiKey": apiKey]
        let response: CustomAuthResponse = try await performRequest(endpoint: "/auth/login", body: body, auth: false)
        accessToken = response.accessToken
        return ProviderAuthResult(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresIn: response.expiresIn,
            userId: response.user.id,
            username: response.user.username
        )
    }
    
    func refreshToken() async throws -> String {
        guard let refreshToken = UserDefaults.standard.string(forKey: "custom_refresh_token") else {
            throw ProviderError.unauthorized
        }
        
        let body = ["refreshToken": refreshToken]
        let response: CustomRefreshResponse = try await performRequest(endpoint: "/auth/refresh", body: body, auth: false)
        accessToken = response.accessToken
        return response.accessToken
    }
    
    func signOut() async throws {
        accessToken = nil
        UserDefaults.standard.removeObject(forKey: "custom_refresh_token")
    }
    
    func search(query: String, types: [SearchType], limit: Int, offset: Int) async throws -> SearchResults {
        let params = ["query": query, "limit": String(limit), "offset": String(offset)]
        let response: CustomSearchResponse = try await performGET(endpoint: "/search", params: params)
        
        return SearchResults(
            tracks: response.tracks.map(parseTrack),
            albums: response.albums.map(parseAlbum),
            artists: response.artists.map(parseArtist),
            playlists: response.playlists.map(parsePlaylist),
            videos: []
        )
    }
    
    func getTrack(id: String, quality: AudioQuality) async throws -> Track {
        let response: CustomTrackResponse = try await performGET(endpoint: "/tracks/\(id)", params: [:])
        return parseTrack(response.track)
    }
    
    func getAlbum(id: String) async throws -> Album {
        let response: CustomAlbumResponse = try await performGET(endpoint: "/albums/\(id)", params: [:])
        return parseAlbum(response.album)
    }
    
    func getArtist(id: String) async throws -> Artist {
        let response: CustomArtistResponse = try await performGET(endpoint: "/artists/\(id)", params: [:])
        return parseArtist(response.artist)
    }
    
    func getPlaylist(id: String) async throws -> ProviderPlaylist {
        let response: CustomPlaylistResponse = try await performGET(endpoint: "/playlists/\(id)", params: [:])
        return parsePlaylist(response.playlist)
    }
    
    func getUserPlaylists() async throws -> [ProviderPlaylist] {
        let response: CustomUserPlaylistsResponse = try await performGET(endpoint: "/me/playlists", params: [:])
        return response.playlists.map(parsePlaylist)
    }
    
    func getUserLibrary() async throws -> UserLibrary {
        let response: CustomUserLibraryResponse = try await performGET(endpoint: "/me/library", params: [:])
        return UserLibrary(
            tracks: response.tracks.map(parseTrack),
            albums: response.albums.map(parseAlbum),
            artists: response.artists.map(parseArtist),
            playlists: response.playlists.map(parsePlaylist)
        )
    }
    
    func getRecommendations(basedOn: [String], limit: Int) async throws -> [Track] {
        let params = ["seed": basedOn.joined(separator: ","), "limit": String(limit)]
        let response: CustomRecommendationsResponse = try await performGET(endpoint: "/recommendations", params: params)
        return response.tracks.map(parseTrack)
    }
    
    func getCharts() async throws -> Charts {
        let response: CustomChartsResponse = try await performGET(endpoint: "/charts", params: [:])
        return Charts(
            topTracks: response.topTracks.map(parseTrack),
            topAlbums: response.topAlbums.map(parseAlbum),
            topArtists: response.topArtists.map(parseArtist),
            topPlaylists: response.topPlaylists.map(parsePlaylist),
            trending: response.trending.map(parseTrack)
        )
    }
    
    func getNewReleases() async throws -> [Album] {
        let response: CustomNewReleasesResponse = try await performGET(endpoint: "/new-releases", params: [:])
        return response.albums.map(parseAlbum)
    }
    
    func getStreamURL(for track: Track, quality: AudioQuality) async throws -> URL {
        let params = ["quality": quality.rawValue]
        let response: CustomStreamResponse = try await performGET(endpoint: "/tracks/\(track.providerID)/stream", params: params)
        guard let url = URL(string: response.streamUrl) else {
            throw ProviderError.noStreamURL
        }
        return url
    }
    
    func getLyrics(for track: Track) async throws -> Lyrics? {
        let response: CustomLyricsResponse = try await performGET(endpoint: "/tracks/\(track.providerID)/lyrics", params: [:])
        return Lyrics(
            text: response.text,
            syncData: response.synced?.map { LyricLine(time: $0.time, text: $0.text) },
            language: response.language,
            provider: .custom
        )
    }
    
    func addToLibrary(_ item: LibraryItem) async throws {
        let body: [String: String]
        switch item {
        case .track(let track):
            body = ["type": "track", "id": track.providerID]
        case .album(let album):
            body = ["type": "album", "id": album.providerID]
        case .artist(let artist):
            body = ["type": "artist", "id": artist.providerID]
        case .playlist(let playlist):
            body = ["type": "playlist", "id": playlist.providerID]
        }
        try await performPOST(endpoint: "/me/library", body: body)
    }
    
    func removeFromLibrary(_ item: LibraryItem) async throws {
        switch item {
        case .track(let track):
            try await performDELETE(endpoint: "/me/library/tracks/\(track.providerID)")
        case .album(let album):
            try await performDELETE(endpoint: "/me/library/albums/\(album.providerID)")
        case .artist(let artist):
            try await performDELETE(endpoint: "/me/library/artists/\(artist.providerID)")
        case .playlist(let playlist):
            try await performDELETE(endpoint: "/me/library/playlists/\(playlist.providerID)")
        }
    }
    
    func createPlaylist(name: String, description: String?, tracks: [Track]) async throws -> ProviderPlaylist {
        let body: [String: Any] = [
            "name": name,
            "description": description ?? "",
            "trackIds": tracks.map { $0.providerID }
        ]
        let response: CustomPlaylistResponse = try await performRequest(endpoint: "/me/playlists", body: body)
        return parsePlaylist(response.playlist)
    }
    
    func addTracksToPlaylist(_ tracks: [Track], playlistId: String) async throws {
        let body = ["trackIds": tracks.map { $0.providerID }]
        try await performPOST(endpoint: "/playlists/\(playlistId)/tracks", body: body)
    }
    
    func removeTracksFromPlaylist(_ tracks: [Track], playlistId: String) async throws {
        let body = ["trackIds": tracks.map { $0.providerID }]
        try await performPOST(endpoint: "/playlists/\(playlistId)/tracks/remove", body: body)
    }
    
    private func performRequest<T: Decodable>(endpoint: String, body: [String: Any], auth: Bool = true) async throws -> T {
        var request = URLRequest(url: URL(string: "\(baseURL)\(endpoint)")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        if auth, let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ProviderError.invalidResponse
        }
        
        if httpResponse.statusCode == 401 {
            _ = try await refreshToken()
            return try await performRequest(endpoint: endpoint, body: body, auth: auth)
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw ProviderError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(T.self, from: data)
    }
    
    private func performGET<T: Decodable>(endpoint: String, params: [String: String]) async throws -> T {
        var components = URLComponents(string: "\(baseURL)\(endpoint)")!
        components.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
        
        var request = URLRequest(url: components.url!)
        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ProviderError.invalidResponse
        }
        
        if httpResponse.statusCode == 401 {
            _ = try await refreshToken()
            return try await performGET(endpoint: endpoint, params: params)
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw ProviderError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(T.self, from: data)
    }
    
    private func performPOST(endpoint: String, body: [String: Any]) async throws {
        var request = URLRequest(url: URL(string: "\(baseURL)\(endpoint)")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        try await validateResponse(of: request)
    }
    
    private func performDELETE(endpoint: String) async throws {
        var request = URLRequest(url: URL(string: "\(baseURL)\(endpoint)")!)
        request.httpMethod = "DELETE"
        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        try await validateResponse(of: request)
    }
    
    private func validateResponse(of request: URLRequest) async throws {
        var request = request
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ProviderError.invalidResponse
        }
        if httpResponse.statusCode == 401 {
            _ = try await refreshToken()
            if let token = accessToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            return try await validateResponse(of: request)
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            throw ProviderError.httpError(httpResponse.statusCode)
        }
    }
    
    private func parseTrack(_ cTrack: CustomTrack) -> Track {
        Track(
            id: cTrack.id,
            title: cTrack.title,
            artist: cTrack.artist,
            provider: .custom,
            providerID: cTrack.id,
            duration: cTrack.duration
        )
    }
    
    private func parseAlbum(_ cAlbum: CustomAlbum) -> Album {
        Album(
            id: cAlbum.id,
            title: cAlbum.title,
            artist: cAlbum.artist,
            artistId: cAlbum.artistId ?? "",
            artworkURL: cAlbum.coverUrl,
            releaseDate: cAlbum.releaseDate.flatMap { ISO8601DateFormatter().date(from: $0) },
            trackCount: cAlbum.trackCount,
            duration: cAlbum.duration,
            provider: .custom,
            providerID: cAlbum.id,
            isExplicit: cAlbum.explicit ?? false,
            genres: cAlbum.genres ?? [],
            copyright: cAlbum.copyright
        )
    }
    
    private func parseArtist(_ cArtist: CustomArtist) -> Artist {
        Artist(
            id: cArtist.id,
            name: cArtist.name,
            artworkURL: cArtist.imageUrl,
            biography: cArtist.bio,
            genres: cArtist.genres ?? [],
            provider: .custom,
            providerID: cArtist.id,
            monthlyListeners: cArtist.monthlyListeners
        )
    }
    
    private func parsePlaylist(_ cPlaylist: CustomPlaylist) -> ProviderPlaylist {
        ProviderPlaylist(
            id: cPlaylist.id,
            name: cPlaylist.name,
            description: cPlaylist.description,
            artworkURL: cPlaylist.coverUrl,
            trackCount: cPlaylist.trackCount,
            duration: cPlaylist.duration,
            owner: cPlaylist.ownerName,
            ownerId: cPlaylist.ownerId,
            isPublic: cPlaylist.isPublic,
            isCollaborative: cPlaylist.isCollaborative ?? false,
            provider: .custom,
            providerID: cPlaylist.id,
            createdAt: cPlaylist.createdAt.flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date(),
            updatedAt: cPlaylist.updatedAt.flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date()
        )
    }
}

struct CustomAuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: TimeInterval?
    let user: CustomUser
}

struct CustomUser: Decodable {
    let id: String
    let username: String
}

struct CustomRefreshResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: TimeInterval?
}

struct CustomSearchResponse: Decodable {
    let tracks: [CustomTrack]
    let albums: [CustomAlbum]
    let artists: [CustomArtist]
    let playlists: [CustomPlaylist]
}

struct CustomTrack: Decodable {
    let id: String
    let title: String
    let artist: String
    let album: String?
    let coverUrl: String?
    let duration: TimeInterval
    let isExplicit: Bool?
    let isrc: String?
}

struct CustomAlbum: Decodable {
    let id: String
    let title: String
    let artist: String
    let artistId: String?
    let coverUrl: String?
    let releaseDate: String?
    let trackCount: Int
    let duration: TimeInterval
    let explicit: Bool?
    let genres: [String]?
    let copyright: String?
}

struct CustomArtist: Decodable {
    let id: String
    let name: String
    let imageUrl: String?
    let bio: String?
    let genres: [String]?
    let monthlyListeners: Int?
}

struct CustomPlaylist: Decodable {
    let id: String
    let name: String
    let description: String?
    let coverUrl: String?
    let trackCount: Int
    let duration: TimeInterval
    let ownerName: String
    let ownerId: String
    let isPublic: Bool
    let isCollaborative: Bool?
    let createdAt: String?
    let updatedAt: String?
}

struct CustomTrackResponse: Decodable { let track: CustomTrack }
struct CustomAlbumResponse: Decodable { let album: CustomAlbum }
struct CustomArtistResponse: Decodable { let artist: CustomArtist }
struct CustomPlaylistResponse: Decodable { let playlist: CustomPlaylist }
struct CustomUserPlaylistsResponse: Decodable { let playlists: [CustomPlaylist] }

struct CustomUserLibraryResponse: Decodable {
    let tracks: [CustomTrack]
    let albums: [CustomAlbum]
    let artists: [CustomArtist]
    let playlists: [CustomPlaylist]
}

struct CustomRecommendationsResponse: Decodable { let tracks: [CustomTrack] }

struct CustomChartsResponse: Decodable {
    let topTracks: [CustomTrack]
    let topAlbums: [CustomAlbum]
    let topArtists: [CustomArtist]
    let topPlaylists: [CustomPlaylist]
    let trending: [CustomTrack]
}

struct CustomNewReleasesResponse: Decodable { let albums: [CustomAlbum] }

struct CustomStreamResponse: Decodable { let streamUrl: String }

struct CustomLyricsResponse: Decodable {
    let text: String
    let synced: [CustomSyncedLine]?
    let language: String?
}

struct CustomSyncedLine: Decodable {
    let time: TimeInterval
    let text: String
}