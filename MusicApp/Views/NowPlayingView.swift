import SwiftUI
import AVFoundation

struct NowPlayingView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var playbackVM: PlaybackViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var effectsVM: AudioEffectsViewModel
    
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    themeManager.backgroundColor,
                    themeManager.surfaceColor,
                    themeManager.primaryColor.opacity(0.5)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            .blur(radius: themeManager.isBlurEnabled ? themeManager.blurIntensity : 0)
            
            if let track = playbackVM.currentTrack {
                VStack(spacing: 24) {
                    header
                    
                    artWork(track)
                    
                    trackInfo(track)
                    
                    playbackControls
                    
                    progressBar
                    
                    extrasToolbar
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
            }
        }
    }
    
    private var header: some View {
        HStack {
            Button {
                dismiss()
            } label: {
                Image(systemName: "chevron.down")
                    .font(.title3)
                    .foregroundColor(themeManager.textPrimaryColor)
            }
            Spacer()
            
            Text("Now Playing")
                .font(.headline)
                .foregroundColor(themeManager.textPrimaryColor)
            Spacer()
            
            Menu {
                Button(playbackVM.isShuffled ? "Shuffle Off" : "Shuffle On") {
                    playbackVM.setShuffle(!playbackVM.isShuffled)
                }
                
                Button(playbackVM.repeatMode == .all ? "Repeat All" : playbackVM.repeatMode == .one ? "Repeat One" : "Repeat Off") {
                    switch playbackVM.repeatMode {
                    case .off: playbackVM.setRepeatMode(.all)
                    case .all: playbackVM.setRepeatMode(.one)
                    case .one: playbackVM.setRepeatMode(.off)
                    }
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.title3)
                    .foregroundColor(themeManager.textPrimaryColor)
            }
        }
    }
    
    private func artWork(_ track: Track) -> some View {
        AsyncImage(url: URL(string: track.artworkURL ?? "")) { image in
            image
                .resizable()
                .scaledToFit()
                .frame(width: 320, height: 320)
                .clipShape(RoundedRectangle(cornerRadius: themeManager.cornerRadius + 8))
                .shadow(color: themeManager.accentColor.opacity(0.4), radius: 25)
        } placeholder: {
            ZStack {
                RoundedRectangle(cornerRadius: themeManager.cornerRadius + 8)
                    .fill(themeManager.surfaceColor)
                Image(systemName: "music.note")
                    .font(.system(size: 60))
                    .foregroundColor(themeManager.textSecondaryColor)
            }
            .frame(width: 320, height: 320)
            .shadow(color: themeManager.accentColor.opacity(0.4), radius: 25)
        }
    }
    
    private func trackInfo(_ track: Track) -> some View {
        VStack(spacing: 6) {
            Text(track.title)
                .font(themeManager.fontBold(size: 24))
                .foregroundColor(themeManager.textPrimaryColor)
                .lineLimit(2)
                .multilineTextAlignment(.center)
            
            Text(track.artist)
                .font(themeManager.font(size: 16))
                .foregroundColor(themeManager.textSecondaryColor)
                .lineLimit(1)
            
            HStack(spacing: 8) {
                Image(systemName: track.provider.iconName)
                Text(track.provider.displayName)
            }
            .font(.caption2)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(themeManager.accentColor.opacity(0.2))
            .clipShape(Capsule())
            .foregroundColor(themeManager.accentColor)
        }
    }
    
    private var playbackControls: some View {
        HStack(spacing: 32) {
            Button {
                playbackVM.setShuffle(!playbackVM.isShuffled)
            } label: {
                Image(systemName: "shuffle")
                    .font(.title2)
                    .foregroundColor(playbackVM.isShuffled ? themeManager.accentColor : themeManager.textSecondaryColor)
            }
            .buttonStyle(.plain)
            
            Button {
                playbackVM.previous()
            } label: {
                Image(systemName: "backward.fill")
                    .font(.system(size: 34))
                    .foregroundColor(themeManager.textPrimaryColor)
            }
            .buttonStyle(.plain)
            
            Button {
                playbackVM.togglePlayPause()
            } label: {
                ZStack {
                    Circle()
                        .fill(themeManager.accentColor)
                        .frame(width: 72, height: 72)
                        .shadow(color: themeManager.accentColor.opacity(0.5), radius: 12)
                    
                    Image(systemName: playbackVM.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 28))
                        .foregroundColor(.white)
                        .offset(x: playbackVM.isPlaying ? 0 : 2)
                }
            }
            .buttonStyle(.plain)
            
            Button {
                playbackVM.next()
            } label: {
                Image(systemName: "forward.fill")
                    .font(.system(size: 34))
                    .foregroundColor(themeManager.textPrimaryColor)
            }
            .buttonStyle(.plain)
            
            Menu {
                Button(playbackVM.repeatMode == .all ? "Repeat All" : playbackVM.repeatMode == .one ? "Repeat One" : "Repeat Off") {
                    switch playbackVM.repeatMode {
                    case .off: playbackVM.setRepeatMode(.all)
                    case .all: playbackVM.setRepeatMode(.one)
                    case .one: playbackVM.setRepeatMode(.off)
                    }
                }
            } label: {
                Image(systemName: playbackVM.repeatMode == .off ? "repeat" : playbackVM.repeatMode == .one ? "repeat.1" : "repeat")
                    .font(.title2)
                    .foregroundColor(playbackVM.repeatMode == .off ? themeManager.textSecondaryColor : themeManager.accentColor)
            }
        }
    }
    
    private var progressBar: some View {
        VStack(spacing: 4) {
            Slider(
                value: Binding(
                    get: { playbackVM.currentTime },
                    set: { playbackVM.seek(to: $0) }
                ),
                in: 0...max(playbackVM.duration, 1)
            )
            .tint(themeManager.accentColor)
            
            HStack {
                Text(formatTime(playbackVM.currentTime))
                Spacer()
                Text(formatTime(playbackVM.duration))
            }
            .font(.caption2.monospacedDigit())
            .foregroundColor(themeManager.textSecondaryColor)
        }
    }
    
    private var extrasToolbar: some View {
        HStack(spacing: 28) {
            Button {
                if let track = playbackVM.currentTrack {
                    playbackVM.toggleLike(track)
                }
            } label: {
                Image(systemName: playbackVM.currentTrack.map { playbackVM.likedTracks.contains($0.id) } ?? false ? "heart.fill" : "heart")
                    .font(.title3)
                    .foregroundColor(playbackVM.currentTrack.map { playbackVM.likedTracks.contains($0.id) } ?? false ? themeManager.accentColor : themeManager.textSecondaryColor)
            }
            .buttonStyle(.plain)
            
            NavigationLink {
                AudioEffectsView()
            } label: {
                Image(systemName: "slider.horizontal.3")
                    .font(.title3)
                    .foregroundColor(themeManager.textSecondaryColor)
            }
            
            Button {
                if let track = playbackVM.currentTrack {
                    shareTrack(track)
                }
            } label: {
                Image(systemName: "square.and.arrow.up")
                    .font(.title3)
                    .foregroundColor(themeManager.textSecondaryColor)
            }
            .buttonStyle(.plain)
            
            Button {
                if let track = playbackVM.currentTrack {
                    showLyrics(track)
                }
            } label: {
                Image(systemName: "text.quote")
                    .font(.title3)
                    .foregroundColor(themeManager.textSecondaryColor)
            }
            .buttonStyle(.plain)
            
            Button {
                if let track = playbackVM.currentTrack {
                    addToQueue(track)
                }
            } label: {
                Image(systemName: "text.badge.plus")
                    .font(.title3)
                    .foregroundColor(themeManager.textSecondaryColor)
            }
            .buttonStyle(.plain)
        }
    }
    
    private func formatTime(_ time: TimeInterval) -> String {
        let minutes = Int(time) / 60
        let seconds = Int(time) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
    
    private func shareTrack(_ track: Track) {
        // Implement share sheet
    }
    
    private func showLyrics(_ track: Track) {
        // Present lyrics view
    }
    
    private func addToQueue(_ track: Track) {
        // Add to queue
    }
}