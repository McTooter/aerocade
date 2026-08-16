import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var playbackVM: PlaybackViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var effectsVM: AudioEffectsViewModel
    @State private var activeProfile = DatabaseManager.shared.activeProfile
    @State private var greeting = ""
    @State private var featuredTracks: [Track] = []
    @State private var recentPlayed: [PlayHistory] = []
    @State private var isLoading = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                themeManager.backgroundColor.ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        header
                        
                        if isLoading {
                            ProgressView()
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.top, 50)
                        } else {
                            recentlyPlayedSection
                            featuredSection
                            quickPicksSection
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Home")
            .navigationBarHidden(true)
        }
    }
    
    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(greeting)
                    .font(themeManager.font(size: 14))
                    .foregroundColor(themeManager.textSecondaryColor)
                Text(activeProfile?.name ?? "Listener")
                    .font(themeManager.fontBold(size: 28))
                    .foregroundColor(themeManager.textPrimaryColor)
            }
            
            Spacer()
            
            Button {
                // Show profile switcher
            } label: {
                if let profile = activeProfile {
                    AvatarView(profile: profile, size: 44)
                } else {
                    Image(systemName: "person.circle.fill")
                        .font(.title)
                        .foregroundColor(themeManager.textSecondaryColor)
                }
            }
        }
    }
    
    private var recentlyPlayedSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recently Played")
                .font(themeManager.fontBold(size: 20))
                .foregroundColor(themeManager.textPrimaryColor)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(recentPlayed) { history in
                        Button {
                            Task {
                                await playbackVM.playTrack(history.track)
                            }
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                TrackArtworkView(track: history.track, size: 120, themeManager: themeManager)
                                Text(history.track.title)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundColor(themeManager.textPrimaryColor)
                                    .lineLimit(1)
                                Text(history.track.artist)
                                    .font(.caption)
                                    .foregroundColor(themeManager.textSecondaryColor)
                                    .lineLimit(1)
                            }
                            .frame(width: 120)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
    
    private var featuredSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Made For You")
                .font(themeManager.fontBold(size: 20))
                .foregroundColor(themeManager.textPrimaryColor)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(featuredTracks, id: \.id) { track in
                        Button {
                            Task {
                                await playbackVM.playTrack(track)
                            }
                        } label: {
                            TrackArtworkView(track: track, size: 160, themeManager: themeManager)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
    
    private var quickPicksSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Quick Picks")
                .font(themeManager.fontBold(size: 20))
                .foregroundColor(themeManager.textPrimaryColor)
            
            ForEach(featuredTracks.prefix(10), id: \.id) { track in
                Button {
                    Task {
                        await playbackVM.playTrack(track)
                    }
                } label: {
                    HStack(spacing: 12) {
                        TrackArtworkView(track: track, size: 44, themeManager: themeManager)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(track.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(themeManager.textPrimaryColor)
                                .lineLimit(1)
                            Text(track.artist)
                                .font(.caption)
                                .foregroundColor(themeManager.textSecondaryColor)
                                .lineLimit(1)
                        }
                        Spacer()
                        Menu {
                            Button {
                                Task { await playbackVM.playTrack(track) }
                            } label: {
                                Label("Play Now", systemImage: "play.fill")
                            }
                            Button {
                                // Add to playlist
                            } label: {
                                Label("Add to Playlist", systemImage: "plus.circle")
                            }
                            Button {
                                playbackVM.toggleLike(track)
                            } label: {
                                Label(playbackVM.likedTracks.contains(track.id) ? "Unlike" : "Like", systemImage: "heart")
                            }
                        } label: {
                            Image(systemName: "ellipsis")
                                .foregroundColor(themeManager.textSecondaryColor)
                        }
                    }
                    .padding(8)
                    .background(themeManager.surfaceColor.opacity(0.5))
                    .clipShape(RoundedRectangle(cornerRadius: themeManager.cornerRadius))
                }
                .buttonStyle(.plain)
            }
        }
    }
    
    private func loadData() {
        guard let profile = DatabaseManager.shared.activeProfile else { return }
        
        greeting = greetingForTime()
        isLoading = true
        
        Task {
            recentPlayed = (try? DatabaseManager.shared.playHistory(for: profile)) ?? []
            featuredTracks = createFeaturedTracks()
            isLoading = false
        }
    }
    
    private func greetingForTime() -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<12: return "Good Morning"
        case 12..<17: return "Good Afternoon"
        default: return "Good Evening"
        }
    }
    
    private func createFeaturedTracks() -> [Track] {
        // Placeholder tracks until providers are integrated
        [
            Track(id: "demo1", title: "Midnight City", artist: "Neon Waves", provider: .custom, providerID: "demo1", duration: 240),
            Track(id: "demo2", title: "Solar Dreams", artist: "Lumina", provider: .custom, providerID: "demo2", duration: 210),
            Track(id: "demo3", title: "Electric Feel", artist: "Pulse", provider: .custom, providerID: "demo3", duration: 260),
            Track(id: "demo4", title: "Ocean Drive", artist: "Vitra", provider: .custom, providerID: "demo4", duration: 230),
            Track(id: "demo5", title: "Gravity", artist: "Nova", provider: .custom, providerID: "demo5", duration: 250)
        ]
    }
    
    var greetingForPreview: String { greetingForTime() }
}

struct TrackArtworkView: View {
    let track: Track
    let size: CGFloat
    let themeManager: ThemeManager
    
    var body: some View {
        AsyncImage(url: URL(string: track.artworkURL ?? "")) { image in
            image
                .resizable()
                .scaledToFill()
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: themeManager.cornerRadius))
        } placeholder: {
            ZStack {
                RoundedRectangle(cornerRadius: themeManager.cornerRadius)
                    .fill(themeManager.surfaceColor)
                Image(systemName: track.provider.iconName)
                    .font(.system(size: size * 0.3))
                    .foregroundColor(themeManager.accentColor.opacity(0.6))
            }
            .frame(width: size, height: size)
        }
    }
}