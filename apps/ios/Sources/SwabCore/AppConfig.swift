/// G1 — typed, env-sourced config, validated (fail-fast) at boot.
///
/// iOS has no `ProcessInfo.environment` equivalent to Expo's
/// `EXPO_PUBLIC_API_URL` on a device build (env vars don't reach app
/// processes outside Xcode's debug launch) — Info.plist, fed by build
/// settings, is the native equivalent. `SwabApiBaseURL`/`SwabPhoneHashSalt`
/// are set per build configuration in `SwabApp.xcodeproj/project.pbxproj`
/// (`SWAB_API_BASE_URL`/`SWAB_PHONE_HASH_SALT`) and substituted into
/// `App/Info.plist` at build time.
import Foundation

public struct AppConfig: Equatable, Sendable {
    public let apiBaseURL: URL
    public let phoneHashSalt: String

    public enum LoadError: Error, Equatable, Sendable {
        case missingBaseURL
        case invalidBaseURL(String)
        /// A real deployment must be HTTPS; loopback (Simulator/local API)
        /// is exempt from ATS and stays plain HTTP.
        case nonLoopbackRequiresHTTPS(String)
        case missingSalt
    }

    public init(apiBaseURL: URL, phoneHashSalt: String) {
        self.apiBaseURL = apiBaseURL
        self.phoneHashSalt = phoneHashSalt
    }

    /// Real entry point — reads the running app's own bundle.
    public static func load(bundle: Bundle = .main) throws -> AppConfig {
        try load(lookup: { bundle.object(forInfoDictionaryKey: $0) as? String })
    }

    /// Test seam: any string lookup, no real `Bundle`/Info.plist needed.
    static func load(lookup: (String) -> String?) throws -> AppConfig {
        guard let rawURL = lookup("SwabApiBaseURL"), !rawURL.isEmpty else {
            throw LoadError.missingBaseURL
        }
        guard let url = URL(string: rawURL), let scheme = url.scheme, let host = url.host else {
            throw LoadError.invalidBaseURL(rawURL)
        }
        let isLoopback = host == "127.0.0.1" || host == "localhost" || host == "::1"
        if !isLoopback && scheme.lowercased() != "https" {
            throw LoadError.nonLoopbackRequiresHTTPS(rawURL)
        }
        guard let salt = lookup("SwabPhoneHashSalt"), !salt.isEmpty else {
            throw LoadError.missingSalt
        }
        return AppConfig(apiBaseURL: url, phoneHashSalt: salt)
    }
}
