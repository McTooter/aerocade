import SwiftUI

struct LibraryView: View {
    @EnvironmentObject private var playbackVM: PlaybackViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    @State private var playlists: [Playlist] = []
    @State private var likedSongs: [Track] = []
    @State private var downloadedSongs: [DownloadedTrack] = []
    @State private var selectedSection: LibrarySection = .playlists
    @State private var playingPlaylist: Playlist?
    
    enum LibrarySection: String, CaseIterable {
        case playlists = "Playlists"
        case artists = "Artists"
        case albums = "Albums"
        case songs = "Songs"
        case downloads = "Downloads"
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                themeManager.backgroundColor.ignoresSafeArea()
                
                VStack(alignment: .leading, spacing: 16) {
                    Text("Your Library")
                        .font(themeManager.fontBold(size: 28))
                        .foregroundColor(themeManager.textPrimaryColor)
                        .padding(.horizontal)
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(LibrarySection.allCases, id: \.self) { section in
                                Button {
                                    selectedSection = section
                                } label: {
                                    Text(section.rawValue)
                                        .font(.subheadline.weight(selectedSection == section ? .bold : .regular))
                                        .foregroundColor(selectedSection == section ? themeManager.textPrimaryColor : themeManager.textSecondaryColor)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 8)
                                        .background(selectedSection == section ? themeManager.accentColor.opacity(0.25) : themeManager.surfaceColor)
                                        .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal)
                    }
                    
                    ScrollView {
                        switch selectedSection {
                        case .playlists:
                            playlistsView
                        case .songs, .downloads:
                            songsView
                        case .artists, .albums:
                            emptyState("Coming soon")
                        }
                    }
                }
            }
            .navigationTitle("")
            .navigationBarHidden(true)
        }
        .onAppear(perform: loadData)
    }
    
    private var playlistsView: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                createNewPlaylist()
            } label: {
                HStack(spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: themeManager.cornerRadius)
                            .fill(themeManager.accentColor.opacity(0.2))
                            .frame(width: 44, height: 44)
                        Image(systemName: "plus")
                            .foregroundColor(themeManager.accentColor)
                    }
                    Text("New Playlist")
                        .font(themeManager.font(size: 16))
                        .foregroundColor(themeManager.textPrimaryColor)
                }
            }
            .buttonStyle(.plain)
            .padding(.bottom, 8)
            
            ForEach(playlists, id: \.id) { playlist in
                Button {
                    playingPlaylist = playlist
                } label: {
                    HStack(spacing: 12) {
                        if let artworkData = playlist.artworkData, let image = UIImage(data: artworkData) {
                            Image(uiImage: image)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 44, height: 44)
                                .clipShape(RoundedRectangle(cornerRadius: themeManager.cornerRadius))
                        } else {
                            ZStack {
                                RoundedRectangle(cornerRadius: themeManager.cornerRadius)
                                    .fill(themeManager.surfaceColor)
                                    .frame(width: 44, height: 44)
                                Image(systemName: "music.note.list")
                                    .font(.title3)
                                    .foregroundColor(themeManager.accentColor)
                            }
                        }
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text(playlist.name)
                                .font(themeManager.font(size: 16, weight: .semibold))
                                .foregroundColor(themeManager.textPrimaryColor)
                                .lineLimit(1)
                            Text("\(playlist.tracks.count) songs")
                                .font(.caption)
                                .foregroundColor(themeManager.textSecondaryColor)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(themeManager.textSecondaryColor)
                    }
                    .padding(.vertical, 6)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal)
    }
    
    private var songsView: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(likedSongs, id: \.id) { track in
                Button {
                    Task {
                        await playbackVM.loadQueue(likedSongs, startIndex: likedSongs.firstIndex(where: { $0.id == track.id }) ?? 0)
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
                        Menu {
                            Button { Task { await playbackVM.playTrack(track) } } label: {
                                Label("Play", systemImage: "play.fill")
                            }
                            Button { playbackVM.toggleLike(track) } label: {
                                Label("Remove from Liked", systemImage: "heart.slash")
                            }
                        } label: {
                            Image(systemName: "ellipsis")
                                .foregroundColor(themeManager.textSecondaryColor)
                        }
                    }
                    .padding(.vertical, 6)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal)
    }
    
    private func emptyState(_ text: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "music.note")
                .font(.system(size: 48))
                .foregroundColor(themeManager.textSecondaryColor)
            Text(text)
                .font(themeManager.font(size: 16))
                .foregroundColor(themeManager.textSecondaryColor)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
    }
    
    private func loadData() {
        guard let profile = DatabaseManager.shared.activeProfile else { return }
        playlists = (try? DatabaseManager.shared.playlists(for: profile)) ?? []
        likedSongs = playbackVM.likedTracks.compactMap { id in
            Track(id: id, title: "Sorted \(id)", artist: "Artist", provider: .custom, providerID: id, duration: 200)
        }
    }
    
    private func createNewPlaylist() {
        guard let profile = DatabaseManager.shared.activeProfile else { return }
        try? DatabaseManager.shared.createPlaylist(name: "New Playlist", description: nil, for: profile)
        loadData()
    }
}