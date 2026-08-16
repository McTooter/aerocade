import XCTest
@testable import MusicApp

final class MusicAppTests: XCTestCase {
    
    func testTimeIntervalFormatting() {
        let time: TimeInterval = 245
        XCTAssertEqual(time.minutesAndSeconds, "4:05")
    }
    
    func testEmailValidation() {
        XCTAssertTrue("user@example.com".isValidEmail)
        XCTAssertFalse("not-an-email".isValidEmail)
        XCTAssertFalse("user@".isValidEmail)
    }
    
    func testStringInitials() {
        XCTAssertEqual("John Doe".initials, "JD")
        XCTAssertEqual("Madonna".initials, "M")
    }
    
    func testAudioQualityBitrates() {
        XCTAssertEqual(AudioQuality.low.bitrate, 96)
        XCTAssertEqual(AudioQuality.standard.bitrate, 160)
        XCTAssertEqual(AudioQuality.high.bitrate, 320)
        XCTAssertEqual(AudioQuality.lossless.bitrate, 1411)
        XCTAssertEqual(AudioQuality.hires.bitrate, 9216)
    }
    
    func testProviderDisplayNames() {
        XCTAssertEqual(MusicProvider.youtubeMusic.displayName, "YouTube Music")
        XCTAssertEqual(MusicProvider.qobuz.displayName, "Qobuz")
        XCTAssertEqual(MusicProvider.tidal.displayName, "Tidal")
    }
    
    func testDefaultEQHasTenBands() {
        XCTAssertEqual(EQPreset.defaultBands.count, 10)
    }
    
    func testTrackDuration() async {
        let track = Track(
            id: "test1",
            title: "Test Song",
            artist: "Test Artist",
            provider: .local,
            providerID: "test1",
            duration: 180
        )
        XCTAssertEqual(track.duration, 180)
        XCTAssertEqual(track.provider, .local)
        XCTAssertEqual(track.playCount, 0)
    }
}