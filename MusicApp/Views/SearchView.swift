import SwiftUI

struct SearchView: View {
    @EnvironmentObject private var playbackVM: PlaybackViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    @State private var searchText = ""
    @State private var selectedProvider: MusicProviderType = .custom
    @State private var searchResults: SearchResults?
    @State private var resultsPerSection: Dictionary<String, [Track]> = [:]
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?
    @State private var showProviderFilter = false
    
    private let allProviders = MusicProviderType.allCases
    
    var body: some View {
        NavigationStack {
            ZStack {
                themeManager.backgroundColor.ignoresSafeArea()
                
                VStack(spacing: 12) {
                    searchBar
                    providerFilter
                    
                    if isSearching {
                        Spacer()
                        ProgressView()
                        Spacer()
                    } else if let results = searchResults {
                        resultList(results)
                    } else {
                        suggestedSearches
                    }
                }
                .padding()
                
            }
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
    
    private var searchBar: some View {
        HStack(spacing: 10) {
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(themeManager.textSecondaryColor)
                TextField("Search songs, artists, albums", text: $searchText)
                    .foregroundColor(themeManager.textPrimaryColor)
                    .autocorrectionDisabled()
                    .onSubmit {
                        performSearch()
                    }
                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                        searchResults = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(themeManager.textSecondaryColor)
                    }
                }
            }
            .padding(12)
            .background(themeManager.surfaceColor)
            .clipShape(RoundedRectangle(cornerRadius: themeManager.cornerRadius))
            
            Button {
                showProviderFilter.toggle()
            } label: {
                Image(systemName: "line.3.horizontal.decrease.circle")
                    .font(.title3)
                    .foregroundColor(themeManager.accentColor)
            }
        }
    }
    
    private var providerFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(allProviders, id: \.self) { provider in
                    Button {
                        selectedProvider = provider
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: provider.iconName)
                            Text(provider.displayName)
                        }
                        .font(.caption.weight(selectedProvider == provider ? .bold : .regular))
                        .foregroundColor(selectedProvider == provider ? themeManager.textPrimaryColor : themeManager.textSecondaryColor)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(selectedProvider == provider ? themeManager.accentColor : themeManager.surfaceColor)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
    
    private func resultList(_ results: SearchResults) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if !results.tracks.isEmpty {
                    Section("Top Results") {
                        ForEach(results.tracks.prefix(5)) { track in
                            trackRow(track)
                        }
                    }
                }
                
                if !results.albums.isEmpty {
                    Section("Albums") {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(results.albums) { album in
                                    albumCard(album)
                                }
                            }
                        }
                    }
                }
                
                if !results.artists.isEmpty {
                    Section("Artists") {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(results.artists) { artist in
                                    artistCard(artist)
                                }
                            }
                        }
                    }
                }
                
                if !results.playlists.isEmpty {
                    Section("Playlists") {
                        ForEach(results.playlists) { playlist in
                            playlistRow(playlist)
                        }
                    }
                }
            }
        }
    }
    
    private func trackRow(_ track: Track) -> some View {
        Button {
            Task {
                await playbackVM.playTrack(track)
            }
        } label: {
            HStack(spacing: 12) {
                TrackArtworkView(track: track, size: 44, themeManager: themeManager)
                VStack(alignment: .leading, spacing: 2) {
                    Text(track.title)
                        .font(themeManager.font(size: 16, weight: .semibold))
                        .foregroundColor(themeManager.textPrimaryColor)
                        .lineLimit(1)
                    Text(track.artist)
                        .font(.caption)
                        .foregroundColor(themeManager.textSecondaryColor)
                        .lineLimit(1)
                }
                Spacer()
                Image(systemName: track.provider.iconName)
                    .font(.caption)
                    .foregroundColor(themeManager.textSecondaryColor)
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }
    
    private func albumCard(_ album: Album) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            AsyncImage(url: URL(string: album.artworkURL ?? "")) { image in
                image
                    .resizable()
                    .scaledToFill()
                    .frame(width: 140, height: 140)
                    .clipShape(RoundedRectangle(cornerRadius: themeManager.cornerRadius))
            } placeholder: {
                ZStack {
                    RoundedRectangle(cornerRadius: themeManager.cornerRadius)
                        .fill(themeManager.surfaceColor)
                    Image(systemName: "square.stack")
                        .foregroundColor(themeManager.accentColor)
                }
                .frame(width: 140, height: 140)
            }
            Text(album.title)
                .font(themeManager.font(size: 14, weight: .semibold))
                .foregroundColor(themeManager.textPrimaryColor)
                .lineLimit(1)
            Text(album.artist)
                .font(.caption)
                .foregroundColor(themeManager.textSecondaryColor)
                .lineLimit(1)
        }
        .frame(width: 140)
    }
    
    private func artistCard(_ artist: Artist) -> some View {
        VStack(spacing: 8) {
            AsyncImage(url: URL(string: artist.artworkURL ?? "")) { image in
                image
                    .resizable()
                    .scaledToFill()
                    .frame(width: 100, height: 100)
                    .clipShape(Circle())
            } placeholder: {
                Circle()
                    .fill(themeManager.surfaceColor)
                    .frame(width: 100, height: 100)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.title)
                            .foregroundColor(themeManager.accentColor)
                    )
            }
            Text(artist.name)
                .font(themeManager.font(size: 14, weight: .semibold))
                .foregroundColor(themeManager.textPrimaryColor)
                .lineLimit(1)
        }
        .frame(width: 100)
    }
    
    private func playlistRow(_ playlist: Playlist) -> some View {
        HStack(spacing: 12) {
            AsyncImage(url: URL(string: playlist.artworkURL ?? "")) { image in
                image
                    .resizable()
                    .scaledToFill()
                    .frame(width: 44, height: 44)
                    .clipShape(RoundedRectangle(cornerRadius: themeManager.cornerRadius))
            } placeholder: {
                ZStack {
                    RoundedRectangle(cornerRadius: themeManager.cornerRadius)
                        .fill(themeManager.surfaceColor)
                    Image(systemName: "music.note.list")
                        .foregroundColor(themeManager.accentColor)
                }
                .frame(width: 44, height: 44)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(playlist.name)
                    .font(themeManager.font(size: 16, weight: .semibold))
                    .foregroundColor(themeManager.textPrimaryColor)
                    .lineLimit(1)
                Text("By \(playlist.owner) • \(playlist.trackCount) songs")
                    .font(.caption)
                    .foregroundColor(themeManager.textSecondaryColor)
            }
            Spacer()
        }
        .padding(.vertical, 4)
    }
    
    private var suggestedSearches: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Browse")
                .font(themeManager.fontBold(size: 20))
                .foregroundColor(themeManager.textPrimaryColor)
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(suggestedCategories(), id: \.0) { name, color in
                    HStack {
                        Text(name)
                            .font(themeManager.font(size: 15, weight: .semibold))
                            .foregroundColor(.white)
                        Spacer()
                    }
                    .padding()
                    .frame(height: 70)
                    .background(color)
                    .clipShape(RoundedRectangle(cornerRadius: themeManager.cornerRadius))
                }
            }
        }
        .padding(.top, 20)
    }
    
    private func suggestedCategories() -> [(String, Color)] {
        [
            ("Chill", Color(hex: "#9B59B6")),
            ("Focus", Color(hex: "#3498DB")),
            ("Workout", Color(hex: "#E74C3C")),
            ("Party", Color(hex: "#F39C12")),
            ("Sleep", Color(hex: "#2C3E50")),
            ("Rock", Color(hex: "#C0392B")),
            ("Jazz", Color(hex: "#7F8C8D")),
            ("Classical", Color(hex: "#16A085"))
        ]
    }
    
    private func performSearch() {
        guard !searchText.isEmpty else { return }
        
        searchTask?.cancel()
        isSearching = true
        
        searchTask = Task {
            do {
                let provider = ProviderFactory.shared.provider(selectedProvider)
                let result = try await provider.search(
                    query: searchText,
                    types: [.track, .album, .artist, .playlist],
                    limit: 20,
                    offset: 0
                )
                if !Task.isCancelled {
                    searchResults = result
                    isSearching = false
                }
            } catch {
                if !Task.isCancelled {
                    searchResults = nil
                    isSearching = false
                }
            }
        }
    }
}