import Foundation
import SwiftUI
import Combine
import AVFoundation
import MediaPlayer
import UIKit

@MainActor
final class PlaybackViewModel: ObservableObject {
    @Published var currentTrack: Track?
    @Published var queue: [Track] = []
    @Published var currentIndex: Int = -1
    @Published var isPlaying = false
    @Published var currentTime: TimeInterval = 0
    @Published var duration: TimeInterval = 0
    @Published var isShuffled = false
    @Published var repeatMode: RepeatMode = .off
    @Published var volume: Float = 1.0
    @Published var likedTracks: Set<String> = []
    @Published var isMiniPlayerVisible = false
    
    enum RepeatMode: Int {
        case off, all, one
    }
    
    private let audioEngine = AudioEngine.shared
    private var cancellables = Set<AnyCancellable>()
    private var lastCompletedTrackID: String?
    
    var isPlayingFromQueue: Bool {
        !queue.isEmpty
    }
    
    var nextTrack: Track? {
        guard !queue.isEmpty else { return nil }
        switch repeatMode {
        case .off:
            return currentIndex + 1 < queue.count ? queue[currentIndex + 1] : nil
        case .all:
            return queue[(currentIndex + 1) % queue.count]
        case .one:
            return currentTrack
        }
    }
    
    var previousTrack: Track? {
        guard !queue.isEmpty else { return nil }
        let previousIndex = currentIndex - 1
        return previousIndex >= 0 ? queue[previousIndex] : queue.last
    }
    
    init() {
        setupBindings()
        setupRemoteCommandCenter()
        setupAudioSession()
    }
    
    private func setupBindings() {
        audioEngine.$isPlaying
            .assign(to: &$isPlaying)
        
        audioEngine.$currentTime
            .assign(to: &$currentTime)
        
        audioEngine.$duration
            .assign(to: &$duration)
        
        audioEngine.$playbackSpeed
            .sink { [weak self] speed in
                self?.updateNowPlayingInfo()
            }
            .store(in: &cancellables)
        
        NotificationCenter.default.publisher(for: .trackDidFinish)
            .sink { [weak self] _ in
                self?.handleTrackFinished()
            }
            .store(in: &cancellables)
    }
    
    private func setupAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Failed to set audio session: \(error)")
        }
    }
    
    func loadQueue(_ tracks: [Track], startIndex: Int = 0) async {
        queue = tracks
        currentIndex = startIndex
        if startIndex < tracks.count {
            await loadTrack(tracks[startIndex])
        }
    }
    
    func playTrack(_ track: Track) async {
        await loadTrack(track)
    }
    
    func loadTrack(_ track: Track) async {
        do {
            currentTrack = track
            currentIndex = queue.firstIndex(where: { $0.id == track.id }) ?? currentIndex
            try await audioEngine.loadTrack(track)
            audioEngine.play()
            isMiniPlayerVisible = true
            
            if let profile = DatabaseManager.shared.activeProfile {
                DatabaseManager.shared.recordPlay(track, duration: 0, completed: false, for: profile)
            }
            
            updateNowPlayingInfo()
        } catch {
            print("Failed to load track: \(error)")
        }
    }
    
    func togglePlayPause() {
        if isPlaying {
            audioEngine.pause()
        } else {
            audioEngine.play()
        }
    }
    
    func next() {
        guard let nextTrack = nextTrack else { return }
        Task {
            await loadTrack(nextTrack)
        }
    }
    
    func previous() {
        if currentTime > 3 {
            seek(to: 0)
        } else if let previousTrack = previousTrack {
            Task {
                await loadTrack(previousTrack)
            }
        }
    }
    
    func seek(to time: TimeInterval) {
        audioEngine.seek(to: time)
    }
    
    func setShuffle(_ enabled: Bool) {
        isShuffled = enabled
        if enabled, queue.count > 1 {
            let current = queue[currentIndex]
            var shuffled = queue
            shuffled.remove(at: currentIndex)
            shuffled.shuffle()
            shuffled.insert(current, at: 0)
            queue = shuffled
            currentIndex = 0
        }
    }
    
    func setRepeatMode(_ mode: RepeatMode) {
        repeatMode = mode
    }
    
    func toggleLike(_ track: Track) {
        if likedTracks.contains(track.id) {
            likedTracks.remove(track.id)
        } else {
            likedTracks.insert(track.id)
        }
    }
    
    func removeFromQueue(at index: Int) {
        guard index < queue.count else { return }
        queue.remove(at: index)
        if index < currentIndex {
            currentIndex -= 1
        }
    }
    
    func moveTrack(from source: IndexSet, to destination: Int) {
        queue.move(fromOffsets: source, toOffset: destination)
        if let currentTrack = currentTrack {
            currentIndex = queue.firstIndex(where: { $0.id == currentTrack.id }) ?? currentIndex
        }
    }
    
    private func handleTrackFinished() {
        guard lastCompletedTrackID != currentTrack?.id else { return }
        lastCompletedTrackID = currentTrack?.id
        
        if let track = currentTrack {
            if let profile = DatabaseManager.shared.activeProfile {
                DatabaseManager.shared.recordPlay(track, duration: duration, completed: true, for: profile)
            }
        }
        
        switch repeatMode {
        case .off:
            if currentIndex + 1 < queue.count {
                currentIndex += 1
                if currentIndex < queue.count {
                    let track = queue[currentIndex]
                    Task { await loadTrack(track) }
                }
            } else {
                isPlaying = false
                audioEngine.stop()
            }
        case .all:
            currentIndex = (currentIndex + 1) % queue.count
            if currentIndex < queue.count {
                let track = queue[currentIndex]
                Task { await loadTrack(track) }
            }
        case .one:
            if let track = currentTrack {
                Task { await loadTrack(track) }
            }
        }
    }
    
    private func updateNowPlayingInfo() {
        guard let currentTrack = currentTrack else { return }
        
        var nowPlayingInfo = [String: Any]()
        nowPlayingInfo[MPMediaItemPropertyTitle] = currentTrack.title
        nowPlayingInfo[MPMediaItemPropertyArtist] = currentTrack.artist
        nowPlayingInfo[MPMediaItemPropertyAlbumTitle] = currentTrack.album
        nowPlayingInfo[MPMediaItemPropertyPlaybackDuration] = duration
        nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
        nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        
        if let artworkURLString = currentTrack.artworkURL, let artworkURL = URL(string: artworkURLString) {
            Task {
                if let data = try? Data(contentsOf: artworkURL), let image = UIImage(data: data) {
                    nowPlayingInfo[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                    MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
                }
            }
        } else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
        }
    }
    
    private func setupRemoteCommandCenter() {
        let commandCenter = MPRemoteCommandCenter.shared()
        
        commandCenter.playCommand.addTarget { [weak self] _ in
            self?.audioEngine.play()
            return .success
        }
        
        commandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.audioEngine.pause()
            return .success
        }
        
        commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
            self?.togglePlayPause()
            return .success
        }
        
        commandCenter.nextTrackCommand.addTarget { [weak self] _ in
            self?.next()
            return .success
        }
        
        commandCenter.previousTrackCommand.addTarget { [weak self] _ in
            self?.previous()
            return .success
        }
        
        commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            self?.seek(to: event.positionTime)
            return .success
        }
        
        commandCenter.changeShuffleModeCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            self.setShuffle(!self.isShuffled)
            return .success
        }
        
        commandCenter.changeRepeatModeCommand.addTarget { [weak self] event in
            guard let event = event as? MPChangeRepeatModeCommandEvent else { return .commandFailed }
            switch event.repeatType {
            case .all: self?.setRepeatMode(.all)
            case .one: self?.setRepeatMode(.one)
            case .off: self?.setRepeatMode(.off)
            @unknown default: self?.setRepeatMode(.off)
            }
            return .success
        }
    }
}