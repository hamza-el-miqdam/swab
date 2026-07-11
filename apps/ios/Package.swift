// swift-tools-version: 5.10
import PackageDescription

// Swab iOS native app — Swift Package first so everything is CLI-testable
// with `swift test` (no Xcode project required for Wave 1). Zero third-party
// dependencies: CryptoKit, Foundation, Security, SwiftUI/Observation only.
// See apps/ios/CHANGELOG.md for what shipped and what was deferred.
let package = Package(
    name: "Swab",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(name: "SwabCore", targets: ["SwabCore"]),
        .library(name: "SwabUI", targets: ["SwabUI"]),
    ],
    targets: [
        .target(
            name: "SwabCore",
            path: "Sources/SwabCore"
        ),
        .target(
            name: "SwabUI",
            dependencies: ["SwabCore"],
            path: "Sources/SwabUI"
        ),
        .testTarget(
            name: "SwabCoreTests",
            dependencies: ["SwabCore"],
            path: "Tests/SwabCoreTests",
            resources: [
                .copy("Fixtures/vault-test-vectors.json")
            ]
        ),
    ]
)
