import SwiftUI
import SwiftData

struct RootView: View {
    @ObservedObject private var database = DatabaseManager.shared
    @StateObject private var playbackVM = PlaybackViewModel()
    @StateObject private var themeManager = ThemeManager.shared
    
    var body: some View {
        Group {
            if database.activeProfile == nil {
                LoginView()
            } else {
                MainTabView()
                    .environmentObject(playbackVM)
                    .environmentObject(themeManager)
            }
        }
        .onAppear {
            DatabaseManager.shared.configure(modelContext: modelContext)
        }
    }
    
    @Environment(\.modelContext) private var modelContext
}

struct MainTabView: View {
    @State private var selectedTab: Tab = .home
    @EnvironmentObject private var playbackVM: PlaybackViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    @StateObject private var effectsVM = AudioEffectsViewModel()
    
    enum Tab {
        case home, library, search, settings
    }
    
    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $selectedTab) {
                HomeView()
                    .tabItem {
                        Label("Home", systemImage: "house.fill")
                    }
                    .tag(Tab.home)
                
                LibraryView()
                    .tabItem {
                        Label("Library", systemImage: "music.note.list")
                    }
                    .tag(Tab.library)
                
                SearchView()
                    .tabItem {
                        Label("Search", systemImage: "magnifyingglass")
                    }
                    .tag(Tab.search)
                
                SettingsView()
                    .tabItem {
                        Label("Settings", systemImage: "gearshape.fill")
                    }
                    .tag(Tab.settings)
            }
            .tint(themeManager.accentColor)
            
            if playbackVM.isMiniPlayerVisible {
                MiniPlayerView()
                    .padding(.bottom, 46)
                    .transition(.move(edge: .bottom))
            }
        }
        .environmentObject(effectsVM)
        .themed(themeManager)
    }
}

struct MiniPlayerView: View {
    @EnvironmentObject private var playbackVM: PlaybackViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    @State private var showFullPlayer = false
    
    var body: some View {
        HStack(spacing: 12) {
            if let track = playbackVM.currentTrack {
                AsyncImage(url: URL(string: track.artworkURL ?? "")) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    ZStack {
                        themeManager.surfaceColor
                        Image(systemName: "music.note")
                            .foregroundColor(themeManager.textSecondaryColor)
                    }
                }
                .frame(width: 44, height: 44)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .shadow(radius: 3)
                
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
                
                ProgressView(value: playbackVM.currentTime, total: max(playbackVM.duration, 1))
                    .frame(width: 60)
                    .tint(themeManager.accentColor)
                
                Button {
                    playbackVM.togglePlayPause()
                } label: {
                    Image(systemName: playbackVM.isPlaying ? "pause.fill" : "play.fill")
                        .font(.title3)
                        .foregroundColor(themeManager.textPrimaryColor)
                        .frame(width: 36, height: 36)
                        .background(themeManager.accentColor.opacity(0.2))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                
                Button {
                    playbackVM.next()
                } label: {
                    Image(systemName: "forward.fill")
                        .font(.title3)
                        .foregroundColor(themeManager.textPrimaryColor)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(themeManager.accentColor.opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal, 12)
        .onTapGesture {
            showFullPlayer = true
        }
        .fullScreenCover(isPresented: $showFullPlayer) {
            NowPlayingView()
        }
    }
}