import SwiftUI
import AVFoundation

struct AudioEffectsView: View {
    @EnvironmentObject private var effectsVM: AudioEffectsViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        ZStack {
            themeManager.backgroundColor.ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 16) {
                    equalizerCard
                    reverbCard
                    delayCard
                    distortionCard
                    playbackCard
                    spatialCard
                    advancedCard
                }
                .padding()
            }
        }
        .navigationTitle("Audio Effects")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Reset All Effects") {
                        effectsVM.resetAllEffects()
                    }
                    ForEach(effectsVM.presetEQ, id: \.0) { name, gains in
                        Button(name) {
                            effectsVM.applyPresetGains(gains)
                        }
                    }
                } label: {
                    Image(systemName: "slider.horizontal.3")
                }
            }
        }
    }
    
    private var equalizerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Equalizer", systemImage: "slider.horizontal.3")
                    .font(themeManager.fontBold(size: 18))
                    .foregroundColor(themeManager.textPrimaryColor)
                Spacer()
                Menu {
                    ForEach(effectsVM.presetEQ, id: \.0) { name, gains in
                        Button(name) {
                            effectsVM.applyPresetGains(gains)
                        }
                    }
                    if let profile = DatabaseManager.shared.activeProfile {
                        Button("Save Current as Preset") {
                            effectsVM.saveCurrentAsPreset(name: "Custom Preset", for: profile)
                        }
                    }
                } label: {
                    Image(systemName: "square.grid.2x2")
                        .foregroundColor(themeManager.accentColor)
                }
            }
            
            EQBandView(bands: $effectsVM.eqBands, accentColor: themeManager.accentColor)
                .frame(height: 200)
            
            HStack {
                Text("Preamp")
                    .font(.caption)
                    .foregroundColor(themeManager.textSecondaryColor)
                Slider(value: $effectsVM.preamp, in: -12...12)
                    .tint(themeManager.accentColor)
                Text("\(effectsVM.preamp, specifier: "%.1f") dB")
                    .font(.caption.monospacedDigit())
                    .foregroundColor(themeManager.textSecondaryColor)
                    .frame(width: 60, alignment: .trailing)
            }
            
            HStack {
                Text("Bass")
                    .font(.caption)
                    .foregroundColor(themeManager.textSecondaryColor)
                Slider(value: $effectsVM.bassBoost, in: -12...12)
                    .tint(themeManager.accentColor)
                Text("\(effectsVM.bassBoost, specifier: "%.1f") dB")
                    .font(.caption.monospacedDigit())
                    .foregroundColor(themeManager.textSecondaryColor)
                    .frame(width: 60, alignment: .trailing)
            }
            
            HStack {
                Text("Treble")
                    .font(.caption)
                    .foregroundColor(themeManager.textSecondaryColor)
                Slider(value: $effectsVM.trebleBoost, in: -12...12)
                    .tint(themeManager.accentColor)
                Text("\(effectsVM.trebleBoost, specifier: "%.1f") dB")
                    .font(.caption.monospacedDigit())
                    .foregroundColor(themeManager.textSecondaryColor)
                    .frame(width: 60, alignment: .trailing)
            }
        }
        .padding()
        .background(cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: themeManager.cornerRadius))
    }
    
    private var reverbCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Reverb", systemImage: "waveform.path")
                    .font(themeManager.fontBold(size: 18))
                    .foregroundColor(themeManager.textPrimaryColor)
                Spacer()
                Toggle("", isOn: $effectsVM.isReverbEnabled)
                    .tint(themeManager.accentColor)
                    .labelsHidden()
            }
            
            if effectsVM.isReverbEnabled {
                Picker("Preset", selection: $effectsVM.reverbPreset) {
                    ForEach(effectsVM.availableReverbPresets, id: \.0) { preset, name in
                        Text(name).tag(preset)
                    }
                }
                .pickerStyle(.menu)
                
                HStack {
                    Text("Mix")
                        .font(.caption)
                        .foregroundColor(themeManager.textSecondaryColor)
                    Slider(value: $effectsVM.reverbWetDryMix, in: 0...100)
                        .tint(themeManager.accentColor)
                    Text("\(Int(effectsVM.reverbWetDryMix))%")
                        .font(.caption.monospacedDigit())
                        .foregroundColor(themeManager.textSecondaryColor)
                        .frame(width: 50, alignment: .trailing)
                }
                
                HStack {
                    Text("Room Size")
                        .font(.caption)
                        .foregroundColor(themeManager.textSecondaryColor)
                    Slider(value: $effectsVM.reverbRoomSize, in: 0...100)
                        .tint(themeManager.accentColor)
                    Text("\(Int(effectsVM.reverbRoomSize))")
                        .font(.caption.monospacedDigit())
                        .foregroundColor(themeManager.textSecondaryColor)
                        .frame(width: 50, alignment: .trailing)
                }
            }
        }
        .padding()
        .background(cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: themeManager.cornerRadius))
    }
    
    private var delayCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Delay / Echo", systemImage: "timer")
                    .font(themeManager.fontBold(size: 18))
                    .foregroundColor(themeManager.textPrimaryColor)
                Spacer()
                Toggle("", isOn: $effectsVM.isDelayEnabled)
                    .tint(themeManager.accentColor)
                    .labelsHidden()
            }
            
            if effectsVM.isDelayEnabled {
                HStack {
                    Text("Delay Time")
                        .font(.caption)
                        .foregroundColor(themeManager.textSecondaryColor)
                    Slider(value: $effectsVM.delayTime, in: 0.05...2.0)
                        .tint(themeManager.accentColor)
                    Text(String(format: "%.2fs", effectsVM.delayTime))
                        .font(.caption.monospacedDigit())
                        .foregroundColor(themeManager.textSecondaryColor)
                        .frame(width: 60, alignment: .trailing)
                }
                
                HStack {
                    Text("Feedback")
                        .font(.caption)
                        .foregroundColor(themeManager.textSecondaryColor)
                    Slider(value: $effectsVM.delayFeedback, in: 0...100)
                        .tint(themeManager.accentColor)
                    Text("\(Int(effectsVM.delayFeedback))%")
                        .font(.caption.monospacedDigit())
                        .foregroundColor(themeManager.textSecondaryColor)
                        .frame(width: 50, alignment: .trailing)
                }
                
                HStack {
                    Text("Mix")
                        .font(.caption)
                        .foregroundColor(themeManager.textSecondaryColor)
                    Slider(value: $effectsVM.delayWetDryMix, in: 0...100)
                        .tint(themeManager.accentColor)
                    Text("\(Int(effectsVM.delayWetDryMix))%")
                        .font(.caption.monospacedDigit())
                        .foregroundColor(themeManager.textSecondaryColor)
                        .frame(width: 50, alignment: .trailing)
                }
            }
        }
        .padding()
        .background(cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: themeManager.cornerRadius))
    }
    
    private var distortionCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Distortion", systemImage: "bolt.fill")
                    .font(themeManager.fontBold(size: 18))
                    .foregroundColor(themeManager.textPrimaryColor)
                Spacer()
                Toggle("", isOn: $effectsVM.isDistortionEnabled)
                    .tint(themeManager.accentColor)
                    .labelsHidden()
            }
            
            if effectsVM.isDistortionEnabled {
                Picker("Preset", selection: $effectsVM.distortionPreset) {
                    ForEach(effectsVM.availableDistortionPresets, id: \.0) { preset, name in
                        Text(name).tag(preset)
                    }
                }
                .pickerStyle(.menu)
                
                HStack {
                    Text("Mix")
                        .font(.caption)
                        .foregroundColor(themeManager.textSecondaryColor)
                    Slider(value: $effectsVM.distortionWetDryMix, in: 0...100)
                        .tint(themeManager.accentColor)
                    Text("\(Int(effectsVM.distortionWetDryMix))%")
                        .font(.caption.monospacedDigit())
                        .foregroundColor(themeManager.textSecondaryColor)
                        .frame(width: 50, alignment: .trailing)
                }
            }
        }
        .padding()
        .background(cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: themeManager.cornerRadius))
    }
    
    private var playbackCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Playback", systemImage: "play.circle")
                .font(themeManager.fontBold(size: 18))
                .foregroundColor(themeManager.textPrimaryColor)
            
            HStack {
                Text("Speed")
                    .font(.caption)
                    .foregroundColor(themeManager.textSecondaryColor)
                Slider(value: $effectsVM.playbackSpeed, in: 0.25...4.0)
                    .tint(themeManager.accentColor)
                Text(String(format: "%.2fx", effectsVM.playbackSpeed))
                    .font(.caption.monospacedDigit())
                    .foregroundColor(themeManager.textSecondaryColor)
                    .frame(width: 55, alignment: .trailing)
            }
            
            HStack {
                Text("Pitch")
                    .font(.caption)
                    .foregroundColor(themeManager.textSecondaryColor)
                Slider(value: $effectsVM.pitchShift, in: -2400...2400)
                    .tint(themeManager.accentColor)
                Text("\(Int(effectsVM.pitchShift))c")
                    .font(.caption.monospacedDigit())
                    .foregroundColor(themeManager.textSecondaryColor)
                    .frame(width: 55, alignment: .trailing)
            }
            
            HStack {
                Toggle("Volume Normalization", isOn: $effectsVM.isNormalized)
                    .tint(themeManager.accentColor)
            }
            
            HStack {
                Toggle("Crossfade", isOn: $effectsVM.isCrossfadeEnabled)
                    .tint(themeManager.accentColor)
                if effectsVM.isCrossfadeEnabled {
                    Slider(value: $effectsVM.crossfadeDuration, in: 0...12)
                        .tint(themeManager.accentColor)
                    Text("\(Int(effectsVM.crossfadeDuration))s")
                        .font(.caption.monospacedDigit())
                        .foregroundColor(themeManager.textSecondaryColor)
                }
            }
            
            Toggle("Gapless Playback", isOn: $effectsVM.isGaplessEnabled)
                .tint(themeManager.accentColor)
        }
        .padding()
        .background(cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: themeManager.cornerRadius))
    }
    
    private var spatialCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Spatial & Level", systemImage: "speaker.wave.2.fill")
                .font(themeManager.fontBold(size: 18))
                .foregroundColor(themeManager.textPrimaryColor)
            
            HStack {
                Text("Volume")
                    .font(.caption)
                    .foregroundColor(themeManager.textSecondaryColor)
                Slider(value: $effectsVM.volume, in: 0...1)
                    .tint(themeManager.accentColor)
                Text("\(Int(effectsVM.volume * 100))%")
                    .font(.caption.monospacedDigit())
                    .foregroundColor(themeManager.textSecondaryColor)
                    .frame(width: 50, alignment: .trailing)
            }
            
            HStack {
                Text("Balance")
                    .font(.caption)
                    .foregroundColor(themeManager.textSecondaryColor)
                Slider(value: $effectsVM.balance, in: -1...1)
                    .tint(themeManager.accentColor)
                Text(effectsVM.balance < -0.2 ? "L" : effectsVM.balance > 0.2 ? "R" : "C")
                    .font(.caption.monospacedDigit())
                    .foregroundColor(themeManager.textSecondaryColor)
                    .frame(width: 40, alignment: .trailing)
            }
        }
        .padding()
        .background(cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: themeManager.cornerRadius))
    }
    
    private var advancedCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Advanced", systemImage: "gearshape.2.fill")
                .font(themeManager.fontBold(size: 18))
                .foregroundColor(themeManager.textPrimaryColor)
            
            Toggle(isOn: $effectsVM.isReversed) {
                HStack {
                    Image(systemName: "arrow.uturn.left")
                        .foregroundColor(themeManager.accentColor)
                    Text("Reverse Playback")
                }
            }
            .tint(themeManager.accentColor)
            
            Toggle("Noise Gate", isOn: $effectsVM.isNoiseGateEnabled)
                .tint(themeManager.accentColor)
            
            if effectsVM.isNoiseGateEnabled {
                HStack {
                    Text("Threshold")
                        .font(.caption)
                        .foregroundColor(themeManager.textSecondaryColor)
                    Slider(value: $effectsVM.noiseGateThreshold, in: -80...0)
                        .tint(themeManager.accentColor)
                    Text("\(Int(effectsVM.noiseGateThreshold)) dB")
                        .font(.caption.monospacedDigit())
                        .foregroundColor(themeManager.textSecondaryColor)
                        .frame(width: 70, alignment: .trailing)
                }
            }
        }
        .padding()
        .background(cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: themeManager.cornerRadius))
    }
    
    private var cardBackground: some View {
        themeManager.surfaceColor
    }
}

struct EQBandView: View {
    @Binding var bands: [EQBand]
    let accentColor: Color
    
    var body: some View {
        GeometryReader { geo in
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.black.opacity(0.3))
                
                VStack {
                    HStack {
                        Text("+12")
                            .font(.system(size: 9))
                            .foregroundColor(.white.opacity(0.5))
                        Spacer()
                    }
                    Spacer()
                    HStack {
                        Text("0")
                            .font(.system(size: 9))
                            .foregroundColor(.white.opacity(0.5))
                        Spacer()
                    }
                    Spacer()
                    HStack {
                        Text("-12")
                            .font(.system(size: 9))
                            .foregroundColor(.white.opacity(0.5))
                        Spacer()
                    }
                }
                .padding(4)
                
                HStack(alignment: .bottom, spacing: 4) {
                    ForEach(0..<bands.count, id: \.self) { index in
                        VStack {
                            Spacer()
                            littleBar(index: index)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(.vertical, 20)
                
                HStack(alignment: .bottom, spacing: 4) {
                    ForEach(0..<bands.count, id: \.self) { index in
                        VStack {
                            Spacer()
                            bar(index: index)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(.vertical, 20)
            }
        }
    }
    
    private func bar(index: Int) -> some View {
        let normalized = (bands[index].gain + 12) / 24
        let height = max(6, normalized * 120)
        
        return RoundedRectangle(cornerRadius: 3)
            .fill(accentColor)
            .frame(width: 18, height: height)
            .overlay(
                RoundedRectangle(cornerRadius: 3)
                    .stroke(accentColor.opacity(0.6), lineWidth: 1)
            )
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let newGain = max(-12, min(12, 12 - (value.location.y / 160) * 24))
                        bands[index].gain = Float(newGain)
                    }
            )
    }
    
    private func littleBar(index: Int) -> some View {
        RoundedRectangle(cornerRadius: 1.5)
            .fill(Color.white.opacity(0.15))
            .frame(width: 18, height: 6)
    }
}