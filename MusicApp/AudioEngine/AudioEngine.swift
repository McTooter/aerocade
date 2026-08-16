import Foundation
import AVFoundation
import Accelerate
import UIKit

final class AudioEngine: ObservableObject {
    static let shared = AudioEngine()
    
    private let engine = AVAudioEngine()
    private let playerNode = AVAudioPlayerNode()
    private var audioFile: AVAudioFile?
    private var audioBuffer: AVAudioPCMBuffer?
    
    private let eqNode = AVAudioUnitEQ(numberOfBands: 10)
    private let reverbNode = AVAudioUnitReverb()
    private let timePitchNode = AVAudioUnitTimePitch()
    private let distortionNode = AVAudioUnitDistortion()
    private let delayNode = AVAudioUnitDelay()
    private var reversalBuffer: AVAudioPCMBuffer?
    
    @Published var isPlaying = false
    @Published var currentTime: TimeInterval = 0
    @Published var duration: TimeInterval = 0
    @Published var playbackSpeed: Float = 1.0
    @Published var pitch: Float = 1.0
    
    private var displayLink: CADisplayLink?
    private var currentTrack: Track?
    private var scheduledBuffers: [AVAudioPCMBuffer] = []
    
    private init() {
        setupEngine()
        setupNotifications()
    }
    
    private func setupEngine() {
        engine.attach(playerNode)
        engine.attach(eqNode)
        engine.attach(reverbNode)
        engine.attach(timePitchNode)
        engine.attach(distortionNode)
        engine.attach(delayNode)
        
        let format = engine.outputNode.outputFormat(forBus: 0)
        
        engine.connect(playerNode, to: eqNode, format: format)
        engine.connect(eqNode, to: reverbNode, format: format)
        engine.connect(reverbNode, to: timePitchNode, format: format)
        engine.connect(timePitchNode, to: distortionNode, format: format)
        engine.connect(distortionNode, to: delayNode, format: format)
        engine.connect(delayNode, to: engine.mainMixerNode, format: format)
        
        setupDefaultEQ()
        reverbNode.loadFactoryPreset(.largeHall)
        reverbNode.wetDryMix = 0
        timePitchNode.rate = 1.0
        timePitchNode.pitch = 0
        distortionNode.loadFactoryPreset(.multiDistortedFunk)
        distortionNode.wetDryMix = 0
        delayNode.delayTime = 0.5
        delayNode.feedback = 30
        delayNode.wetDryMix = 0
        
        do {
            try engine.start()
        } catch {
            print("AudioEngine failed to start: \(error)")
        }
    }
    
    private func setupDefaultEQ() {
        let bands = EQPreset.defaultBands
        for (index, band) in bands.enumerated() {
            let eqBand = eqNode.bands[index]
            eqBand.filterType = .parametric
            eqBand.frequency = band.frequency
            eqBand.gain = band.gain
            eqBand.bandwidth = band.q
            eqBand.bypass = false
        }
        eqNode.globalGain = 0
    }
    
    private func setupNotifications() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruption),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRouteChange),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
    }
    
    @objc private func handleInterruption(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
        
        if type == .began {
            pause()
        } else if type == .ended {
            if let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt {
                let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                if options.contains(.shouldResume) {
                    play()
                }
            }
        }
    }
    
    @objc private func handleRouteChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else { return }
        
        if reason == .oldDeviceUnavailable {
            pause()
        }
    }
    
    func loadTrack(_ track: Track) async throws {
        stop()
        currentTrack = track
        
        let url: URL
        if let localURL = track.localFileURL {
            url = URL(fileURLWithPath: localURL)
        } else if let streamURL = track.streamURL, let streamURL = URL(string: streamURL) {
            url = streamURL
        } else {
            throw AudioEngineError.noValidURL
        }
        
        audioFile = try AVAudioFile(forReading: url)
        guard let audioFile = audioFile else { throw AudioEngineError.fileLoadFailed }
        
        duration = Double(audioFile.length) / audioFile.fileFormat.sampleRate
        currentTime = 0
        
        let frameCount = AVAudioFrameCount(audioFile.length)
        audioBuffer = AVAudioPCMBuffer(pcmFormat: audioFile.processingFormat, frameCapacity: frameCount)
        
        if let buffer = audioBuffer {
            try audioFile.read(into: buffer)
            prepareReversalBuffer()
        }
        
        scheduleBuffer()
    }
    
    private func prepareReversalBuffer() {
        guard let buffer = audioBuffer,
              let format = AVAudioFormat(standardFormatWithSampleRate: buffer.format.sampleRate, channels: 1) else { return }
        
        reversalBuffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: buffer.frameCapacity)
        guard let reversalBuffer = reversalBuffer else { return }
        
        let channelCount = Int(buffer.format.channelCount)
        let frameLength = Int(buffer.frameLength)
        
        for channel in 0..<channelCount {
            guard let sourceData = buffer.floatChannelData?[channel],
                  let destData = reversalBuffer.floatChannelData?[0] else { continue }
            
            for i in 0..<frameLength {
                destData[i] = sourceData[frameLength - 1 - i]
            }
        }
        
        reversalBuffer.frameLength = buffer.frameLength
    }
    
    private func scheduleBuffer() {
        guard let buffer = audioBuffer else { return }
        playerNode.scheduleBuffer(buffer, at: nil, options: [.loops], completionHandler: nil)
    }
    
    func play() {
        guard !isPlaying else { return }
        playerNode.play()
        isPlaying = true
        startDisplayLink()
    }
    
    func pause() {
        guard isPlaying else { return }
        playerNode.pause()
        isPlaying = false
        stopDisplayLink()
    }
    
    func stop() {
        playerNode.stop()
        isPlaying = false
        currentTime = 0
        stopDisplayLink()
        scheduledBuffers.removeAll()
    }
    
    func seek(to time: TimeInterval) {
        guard let audioFile = audioFile else { return }
        let framePosition = AVAudioFramePosition(time * audioFile.fileFormat.sampleRate)
        playerNode.stop()
        
        if let buffer = audioBuffer {
            playerNode.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
        }
        
        currentTime = time
        if isPlaying {
            playerNode.play()
        }
    }
    
    func setPlaybackSpeed(_ speed: Float) {
        playbackSpeed = max(0.25, min(4.0, speed))
        timePitchNode.rate = playbackSpeed
    }
    
    func setPitch(_ pitch: Float) {
        self.pitch = max(-2400, min(2400, pitch))
        timePitchNode.pitch = self.pitch
    }
    
    func setEQPreset(_ preset: EQPreset) {
        for (index, band) in preset.bands.enumerated() {
            let eqBand = eqNode.bands[index]
            eqBand.frequency = band.frequency
            eqBand.gain = band.gain
            eqBand.bandwidth = band.q
        }
        eqNode.globalGain = preset.preamp
    }
    
    func setEQBand(index: Int, frequency: Float, gain: Float, q: Float) {
        guard index >= 0 && index < eqNode.bands.count else { return }
        let band = eqNode.bands[index]
        band.frequency = frequency
        band.gain = gain
        band.bandwidth = q
    }
    
    func setReverb(preset: AVAudioUnitReverbPreset, wetDryMix: Float) {
        reverbNode.loadFactoryPreset(preset)
        reverbNode.wetDryMix = wetDryMix
    }
    
    func setReverbCustom(wetDryMix: Float, roomSize: Float, damping: Float, width: Float) {
        reverbNode.wetDryMix = wetDryMix
    }
    
    func setDistortion(preset: AVAudioUnitDistortionPreset, wetDryMix: Float) {
        distortionNode.loadFactoryPreset(preset)
        distortionNode.wetDryMix = wetDryMix
    }
    
    func setDelay(time: Float, feedback: Float, wetDryMix: Float) {
        delayNode.delayTime = TimeInterval(time)
        delayNode.feedback = feedback
        delayNode.wetDryMix = wetDryMix
    }
    
    func enableReversal(_ enabled: Bool) {
        guard let buffer = enabled ? reversalBuffer : audioBuffer else { return }
        playerNode.stop()
        playerNode.scheduleBuffer(buffer, at: nil, options: [.loops], completionHandler: nil)
        if isPlaying {
            playerNode.play()
        }
    }
    
    func setVolume(_ volume: Float) {
        engine.mainMixerNode.outputVolume = max(0, min(1, volume))
    }
    
    func setBalance(_ balance: Float) {
        engine.mainMixerNode.pan = max(-1, min(1, balance))
    }
    
    func getFFTData() -> [Float] {
        guard let buffer = audioBuffer,
              let channelData = buffer.floatChannelData?[0] else { return [] }
        
        let frameLength = Int(buffer.frameLength)
        let log2n = vDSP_Length(log2(Float(frameLength)))
        let fftSize = 1 << log2n
        
        var realp = [Float](repeating: 0, count: fftSize/2)
        var imagp = [Float](repeating: 0, count: fftSize/2)
        var output = DSPSplitComplex(realp: &realp, imagp: &imagp)
        
        var window = [Float](repeating: 0, count: fftSize)
        vDSP_hann_window(&window, vDSP_Length(fftSize), Int32(vDSP_HANN_NORM))
        
        var windowed = [Float](repeating: 0, count: fftSize)
        vDSP_vmul(channelData, 1, window, 1, &windowed, 1, vDSP_Length(fftSize))
        
        let setup = vDSP_create_fftsetup(log2n, FFTRadix(kFFTRadix2))
        windowed.withUnsafeBufferPointer { ptr in
            ptr.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: fftSize/2) { complexPtr in
                vDSP_ctoz(complexPtr, 2, &output, 1, vDSP_Length(fftSize/2))
                vDSP_fft_zrip(setup!, &output, 1, log2n, FFTDirection(FFT_FORWARD))
            }
        }
        vDSP_destroy_fftsetup(setup)
        
        var magnitudes = [Float](repeating: 0, count: fftSize/2)
        vDSP_zvmags(&output, 1, &magnitudes, 1, vDSP_Length(fftSize/2))
        
        var normalized = [Float](repeating: 0, count: fftSize/2)
        vDSP_vdbcon(magnitudes, 1, [1], &normalized, 1, vDSP_Length(fftSize/2), 0)
        
        return normalized
    }
    
    private func startDisplayLink() {
        displayLink = CADisplayLink(target: self, selector: #selector(updateCurrentTime))
        displayLink?.add(to: .main, forMode: .common)
    }
    
    private func stopDisplayLink() {
        displayLink?.invalidate()
        displayLink = nil
    }
    
    @objc private func updateCurrentTime() {
        guard let nodeTime = playerNode.lastRenderTime,
              let playerTime = playerNode.playerTime(forNodeTime: nodeTime) else { return }
        
        currentTime = Double(playerTime.sampleTime) / playerTime.sampleRate
        
        if currentTime >= duration - 0.1 {
            NotificationCenter.default.post(name: .trackDidFinish, object: nil)
        }
    }
    
    func getCurrentEQSettings() -> [EQBand] {
        return eqNode.bands.map { band in
            EQBand(frequency: band.frequency, gain: band.gain, q: band.bandwidth)
        }
    }
}

enum AudioEngineError: Error {
    case noValidURL
    case fileLoadFailed
    case bufferCreationFailed
    case engineNotRunning
}

extension Notification.Name {
    static let trackDidFinish = Notification.Name("trackDidFinish")
}