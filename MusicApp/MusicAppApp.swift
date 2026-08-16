import SwiftUI
import SwiftData

@main
struct MusicApp: App {
    let modelContainer: ModelContainer
    
    init() {
        do {
            let schema = Schema([
                UserProfile.self,
                UserPreferences.self,
                Playlist.self,
                PlaylistTrack.self,
                Track.self,
                PlayHistory.self,
                EQPreset.self,
                ThemeConfiguration.self,
                ProviderCredentials.self,
                DownloadedTrack.self
            ])
            let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
            modelContainer = try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Could not initialize ModelContainer: \(error)")
        }
    }
    
    var body: some Scene {
        WindowGroup {
            RootView()
                .modelContainer(modelContainer)
        }
    }
}