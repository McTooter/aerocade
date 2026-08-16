import Foundation
import SwiftUI
import AVFoundation
import Combine

@MainActor
final class AudioEffectsViewModel: ObservableObject {
    @Published var eqBands: [EQBand] = EQPreset.defaultBands
    @Published var preamp: Float = 0
    @Published var bassBoost: Float = 0
    @Published var trebleBoost: Float = 0
    @Published var isReverbEnabled = false
    @Published var reverbPreset: AVAudioUnitReverbPreset = .largeHall
    @Published var reverbWetDryMix: Float = 30
    @Published var reverbRoomSize: Float = 50
    @Published var isDelayEnabled = false
    @Published var delayTime: Float = 0.5
    @Published var delayFeedback: Float = 30
    @Published var delayWetDryMix: Float = 30
    @Published var isDistortionEnabled = false
    @Published var distortionPreset: AVAudioUnitDistortionPreset = .multiDistortedFunk
    @Published var distortionWetDryMix: Float = 30
    @Published var isReversed = false
    @Published var playbackSpeed: Float = 1.0
    @Published var pitchShift: Float = 0
    @Published var volume: Float = 1.0
    @Published var balance: Float = 0
    @Published var isNormalized: Bool = false
    @Published var isCrossfadeEnabled = false
    @Published var crossfadeDuration: TimeInterval = 0
    @Published var isGaplessEnabled = true
    @Published var echoEnabled = false
    @Published var echoFeedback: Float = 0.5
    @Published var isNoiseGateEnabled = false
    @Published var noiseGateThreshold: Float = -60
    
    private let audioEngine = AudioEngine.shared
    private var cancellables = Set<AnyCancellable>()
    
    let availableReverbPresets: [(AVAudioUnitReverbPreset, String)] = [
        (.smallRoom, "Small Room"),
        (.mediumRoom, "Medium Room"),
        (.largeRoom, "Large Room"),
        (.mediumHall, "Medium Hall"),
        (.largeHall, "Large Hall"),
        (.mediumChamber, "Medium Chamber"),
        (.largeChamber, "Large Chamber"),
        (.cathedral, "Cathedral"),
        (.plate, "Plate"),
        (.mediumHall2, "Medium Hall 2"),
        (.largeHall2, "Large Hall 2")
    ]
    
    let availableDistortionPresets: [(AVAudioUnitDistortionPreset, String)] = [
        (.drumsBitBrush, "Drums Bit Brush"),
        (.drumsBufferBeats, "Drums Buffer Beats"),
        (.drumsLoFi, "Drums LoFi"),
        (.multiBrokenSpeaker, "Multi Broken Speaker"),
        (.multiCellphoneConcert, "Multi Cellphone Concert"),
        (.multiDecimated1, "Multi Decimated 1"),
        (.multiDecimated2, "Multi Decimated 2"),
        (.multiDecimated3, "Multi Decimated 3"),
        (.multiDecimated4, "Multi Decimated 4"),
        (.multiDistortedFunk, "Multi Distorted Funk"),
        (.multiDistortedCubed, "Multi Distorted Cubed"),
        (.multiDistortedSquared, "Multi Distorted Squared"),
        (.multiEcho1, "Multi Echo 1"),
        (.multiEcho2, "Multi Echo 2"),
        (.multiEchoTight1, "Multi Echo Tight 1"),
        (.multiEchoTight2, "Multi Echo Tight 2"),
        (.multiEverythingIsBroken, "Multi Everything Is Broken"),
        (.speechAlienChatter, "Speech Alien Chatter"),
        (.speechCosmicInterference, "Speech Cosmic Interference"),
        (.speechGoldenPi, "Speech Golden Pi"),
        (.speechRadioTower, "Speech Radio Tower"),
        (.speechWaves, "Speech Waves")
    ]
    
    let presetEQ: [(String, [Float])] = [
        ("Flat", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        ("Bass Boost", [6, 5, 4, 2, 1, 0, 0, 0, 0, 0]),
        ("Treble Boost", [0, 0, 0, 0, 0, 0, 2, 4, 5, 6]),
        ("V-Shape", [6, 4, 2, 0, -1, -1, 0, 2, 4, 6]),
        ("Rock", [6, 4, 3, 1, -1, 1, 3, 4, 4, 2]),
        ("Pop", [-1, 2, 4, 3, -1, -1, 2, 3, 2, 1]),
        ("Jazz", [4, 3, 1, 2, -1, -1, 1, 2, 3, 3]),
        ("Classical", [4, 3, 2, 1, 0, 0, 1, 2, 3, 4]),
        ("Dance", [5, 4, 3, 2, 0, 0, 1, 2, 3, 4]),
        ("Electronic", [4, 3, 2, 1, 0, 0, 1, 2, 3, 4]),
        ("Loudness", [4, 3, 2, 1, 0, 0, 1, 2, 3, 4]),
        ("Vocal Booster", [0, 0, 0, 2, 3, 4, 3, 2, 1, 0])
    ]
    
    init() {
        setupBindings()
    }
    
    private func setupBindings() {
        $eqBands.sink { [weak self] bands in
            guard let self = self else { return }
            for (index, band) in bands.enumerated() {
                self.audioEngine.setEQBand(index: index, frequency: band.frequency, gain: band.gain, q: band.q)
            }
        }.store(in: &cancellables)
        
        $preamp.sink { [weak self] value in
            self?.audioEngine.setEQPreset(EQPreset(name: "Custom", bands: self?.eqBands ?? [], preamp: value))
        }.store(in: &cancellables)
        
        $isReverbEnabled.sink { [weak self] enabled in
            guard let self = self else { return }
            self.audioEngine.setReverb(preset: self.reverbPreset, wetDryMix: enabled ? self.reverbWetDryMix : 0)
        }.store(in: &cancellables)
        
        $reverbWetDryMix.sink { [weak self] value in
            guard let self = self else { return }
            if self.isReverbEnabled {
                self.audioEngine.setReverb(preset: self.reverbPreset, wetDryMix: value)
            }
        }.store(in: &cancellables)
        
        $reverbPreset.sink { [weak self] preset in
            guard let self = self else { return }
            if self.isReverbEnabled {
                self.audioEngine.setReverb(preset: preset, wetDryMix: self.reverbWetDryMix)
            }
        }.store(in: &cancellables)
        
        $isDelayEnabled.sink { [weak self] enabled in
            guard let self = self else { return }
            self.audioEngine.setDelay(time: self.delayTime, feedback: self.delayFeedback, wetDryMix: enabled ? self.delayWetDryMix : 0)
        }.store(in: &cancellables)
        
        $delayWetDryMix.sink { [weak self] value in
            guard let self = self else { return }
            if self.isDelayEnabled {
                self.audioEngine.setDelay(time: self.delayTime, feedback: self.delayFeedback, wetDryMix: value)
            }
        }.store(in: &cancellables)
        
        $isDistortionEnabled.sink { [weak self] enabled in
            guard let self = self else { return }
            self.audioEngine.setDistortion(preset: self.distortionPreset, wetDryMix: enabled ? self.distortionWetDryMix : 0)
        }.store(in: &cancellables)
        
        $distortionWetDryMix.sink { [weak self] value in
            guard let self = self else { return }
            if self.isDistortionEnabled {
                self.audioEngine.setDistortion(preset: self.distortionPreset, wetDryMix: value)
            }
        }.store(in: &cancellables)
        
        $isReversed.sink { [weak self] enabled in
            self?.audioEngine.enableReversal(enabled)
        }.store(in: &cancellables)
        
        $playbackSpeed.sink { [weak self] speed in
            self?.audioEngine.setPlaybackSpeed(speed)
        }.store(in: &cancellables)
        
        $pitchShift.sink { [weak self] pitch in
            self?.audioEngine.setPitch(pitch)
        }.store(in: &cancellables)
        
        $volume.sink { [weak self] volume in
            self?.audioEngine.setVolume(volume)
        }.store(in: &cancellables)
        
        $balance.sink { [weak self] balance in
            self?.audioEngine.setBalance(balance)
        }.store(in: &cancellables)
        
        $isNormalized.sink { [weak self] normalized in
            if normalized {
                self?.audioEngine.setVolume(1.0)
            }
        }.store(in: &cancellables)
    }
    
    func applyPreset(_ preset: EQPreset) {
        eqBands = preset.bands
        preamp = preset.preamp
    }
    
    func applyPresetGains(_ gains: [Float]) {
        for (index, gain) in gains.enumerated() where index < eqBands.count {
            eqBands[index].gain = gain
        }
    }
    
    func saveCurrentAsPreset(name: String, for profile: UserProfile) {
        let preset = EQPreset(name: name, bands: eqBands, preamp: preamp)
        DatabaseManager.shared.saveEQPreset(preset, for: profile)
    }
    
    func resetAllEffects() {
        isReverbEnabled = false
        isDelayEnabled = false
        isDistortionEnabled = false
        isReversed = false
        playbackSpeed = 1.0
        pitchShift = 0
        volume = 1.0
        balance = 0
        isNormalized = false
        applyPresetGains(Array(repeating: 0, count: 10))
        preamp = 0
        bassBoost = 0
        trebleBoost = 0
    }
    
    func getFFTData() -> [Float] {
        audioEngine.getFFTData()
    }
}