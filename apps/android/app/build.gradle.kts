plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    jacoco
}

jacoco {
    toolVersion = "0.8.12"
}

android {
    namespace = "com.swab.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.swab.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        // SUG-AND-018: the phone-hash salt is a per-deployment namespace
        // (IDT-06) — must be identical across iOS/Android/API for contact
        // discovery to work, but was hardcoded with no override channel on
        // Android (the RN reference exposed it via EXPO_PUBLIC_PHONE_HASH_SALT).
        // Same default value everywhere for now; a real salt rotation or a
        // staging deployment with its own namespace is now a build-config
        // change, not a code change.
        buildConfigField("String", "PHONE_HASH_SALT", "\"swab-poc-phone-salt-v1\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        // E2E test isolation (apps/android/CHANGELOG.md, e2e suite entry):
        // Android Test Orchestrator restarts the app process AND clears its
        // package data (DataStore prefs — onboarding step, vault, session
        // tokens) before every single @Test, not just once per
        // connectedAndroidTest invocation. A same-process file-deletion
        // approach was tried first and rejected: Jetpack DataStore's
        // `preferencesDataStore` delegate is a process-wide singleton keyed
        // by file path, so deleting that file out from under an
        // already-initialized DataStore instance from a PREVIOUS test in the
        // same instrumentation process corrupts reads for every test after
        // the first one in the run — this was caught live (7/8 E2E tests
        // hung at the very first screen) before landing.
        testInstrumentationRunnerArguments["clearPackageData"] = "true"
    }

    buildTypes {
        debug {
            // 10.0.2.2 is the AVD's alias for the host machine's loopback —
            // `localhost` from inside the emulator means the emulator itself.
            // Points at the local `docker compose up` stack (apps/api).
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3001\"")
        }
        release {
            // SUG-AND-016: release builds previously shipped unminified —
            // every Kotlin symbol name (VaultCrypto, key alias constants,
            // etc.) in cleartext for an app whose product promise is "nothing
            // readable leaves the device". kotlinx-serialization needs the
            // explicit keep rules below; nothing else in this codebase uses
            // reflection (manual DI, no Hilt — AppContainer.kt).
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            buildConfigField("String", "API_BASE_URL", "\"https://api.swab.app\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf("-opt-in=kotlinx.coroutines.ExperimentalCoroutinesApi")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    // Wave-1 domain code lives in src/main/kotlin so it's compiled once and
    // exercised by plain JVM unit tests in src/test/kotlin (no Robolectric,
    // no emulator needed) — see apps/android/CHANGELOG.md.
    sourceSets {
        getByName("main") {
            kotlin.srcDirs("src/main/kotlin")
        }
        getByName("test") {
            kotlin.srcDirs("src/test/kotlin")
        }
        // Variant-selected E2E seed hook (Wave 4): the real implementation is
        // compiled ONLY into debug builds; release gets a no-op twin, so the
        // hook is physically absent from release APKs (see E2ESeedHooks.kt).
        getByName("debug") {
            kotlin.srcDirs("src/debug/kotlin")
        }
        getByName("release") {
            kotlin.srcDirs("src/release/kotlin")
        }
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = false
            isReturnDefaultValues = true
        }
        // Pairs with clearPackageData above — each instrumented @Test gets
        // its own process instead of sharing one across the whole
        // connectedAndroidTest invocation.
        execution = "ANDROIDX_TEST_ORCHESTRATOR"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.09.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")
    implementation("androidx.navigation:navigation-compose:2.7.7")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.1")

    // datastore for the plain (non-classification) onboarding-step + local kv
    // (SharedPreferences is explicitly rejected in the handoff for the vault
    // key; DataStore is used here only for plain, non-secret local state).
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    // --- Unit tests (JVM, no Android framework needed for domain code) ---
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    testImplementation("app.cash.turbine:turbine:1.2.1")
    testImplementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.1")

    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation(composeBom)
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    // Test-only, not shipped in the app: gives each instrumented @Test its
    // own process + clean package data (see testOptions.execution /
    // clearPackageData above) — required for the new e2e/ suite's
    // isolation, see apps/android/CHANGELOG.md.
    androidTestUtil("androidx.test:orchestrator:1.5.1")
}

// Coverage on the domain layer (crypto/identity/vault/network/onboarding-state/
// l10n) — the part android-specialist.md's Definition of Done requires at
// >=80% line coverage. UI (Compose screens/theme), MainActivity/AppContainer
// (manual DI wiring) and the Android-Keystore-backed production stores are
// excluded: they need an emulator/instrumented test, which this environment
// does not have available (see apps/android/CHANGELOG.md).
val domainCoverageExcludes = listOf(
    "**/ui/**",
    "**/MainActivity*",
    "**/AppContainer*",
    "**/DataStoreKeyValueStore*",
    "**/AndroidKeystoreVaultKeyStore*",
    "**/KeystoreTokenStore*",
    "**/KeystoreEnvelope*",
    "**/HttpUrlConnectionTransport*",
    "**/Routes*",
    "**/ComposableSingletons*",
    "**/*\$WhenMappings*",
)

val classDir = layout.buildDirectory.dir("tmp/kotlin-classes/debug")

tasks.register<JacocoReport>("jacocoDomainCoverage") {
    dependsOn("testDebugUnitTest")
    group = "verification"
    description = "Line coverage for Wave-1 domain code (excludes UI/platform glue)."

    reports {
        xml.required.set(true)
        html.required.set(true)
    }

    classDirectories.setFrom(
        files(classDir).asFileTree.matching { exclude(domainCoverageExcludes) },
    )
    sourceDirectories.setFrom(files("src/main/kotlin"))
    executionData.setFrom(
        files(layout.buildDirectory.file("jacoco/testDebugUnitTest.exec")),
    )
}

// SUG-AND-011: jacocoDomainCoverage only generates a report — nothing failed
// the build when coverage dropped, so the 80% floor (G2) was self-reported,
// not enforced. This mirrors the report task's exact class/source/exec-data
// wiring and fails the build below the floor.
tasks.register<JacocoCoverageVerification>("jacocoDomainCoverageVerification") {
    dependsOn("testDebugUnitTest")
    group = "verification"
    description = "Fails if Wave-1 domain line coverage < 80% (G2)."

    classDirectories.setFrom(files(classDir).asFileTree.matching { exclude(domainCoverageExcludes) })
    sourceDirectories.setFrom(files("src/main/kotlin"))
    executionData.setFrom(files(layout.buildDirectory.file("jacoco/testDebugUnitTest.exec")))

    violationRules {
        rule {
            limit {
                counter = "LINE"
                value = "COVEREDRATIO"
                minimum = "0.80".toBigDecimal()
            }
        }
    }
}

tasks.named("check") {
    dependsOn("jacocoDomainCoverageVerification")
}

tasks.withType<Test>().configureEach {
    extensions.configure(JacocoTaskExtension::class) {
        isIncludeNoLocationClasses = true
        excludes = listOf("jdk.internal.*")
    }
}
