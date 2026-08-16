// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MusicApp",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(name: "MusicApp", targets: ["MusicApp"])
    ],
    targets: [
        .target(
            name: "MusicApp",
            path: "MusicApp",
            exclude: ["Resources/Info.plist"],
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "MusicAppTests",
            dependencies: ["MusicApp"],
            path: "MusicAppTests"
        )
    ]
)