/// MAP-02 — the three persistent surfaces. Exactly Carte / Envie /
/// Sous-groupes, labels only — no badge, counter, or dot can be rendered
/// here by construction (ethos law 5). `EnvieView`/`SousGroupesView` are
/// calm placeholders (FS-04/FS-05 seams, not built yet).
import SwabCore
import SwiftUI

public struct MainTabsView: View {
    private let vault: Vault

    public init(vault: Vault) {
        self.vault = vault
    }

    public var body: some View {
        TabView {
            CarteView(viewModel: CarteViewModel(vault: vault))
                .tabItem { Text(Fr.t(.navCarte)) }
                .accessibilityLabel(Fr.t(.navCarte))

            EnvieView()
                .tabItem { Text(Fr.t(.navEnvie)) }
                .accessibilityLabel(Fr.t(.navEnvie))

            SousGroupesView()
                .tabItem { Text(Fr.t(.navSousGroupes)) }
                .accessibilityLabel(Fr.t(.navSousGroupes))
        }
    }
}

/// FS-05 seam — calm placeholder, no functionality yet.
struct EnvieView: View {
    var body: some View {
        VStack(spacing: 12) {
            Text(Fr.t(.envieTitle)).font(.largeTitle.weight(.semibold))
            Text(Fr.t(.enviePlaceholder))
                .foregroundStyle(Color(hex: CarteTheme.textDim))
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: CarteTheme.bg))
    }
}

/// FS-04 seam — calm placeholder, no functionality yet.
struct SousGroupesView: View {
    var body: some View {
        VStack(spacing: 12) {
            Text(Fr.t(.sousgroupesTitle)).font(.largeTitle.weight(.semibold))
            Text(Fr.t(.sousgroupesPlaceholder))
                .foregroundStyle(Color(hex: CarteTheme.textDim))
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: CarteTheme.bg))
    }
}
