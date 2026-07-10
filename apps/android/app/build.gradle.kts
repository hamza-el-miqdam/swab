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

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            // 10.0.2.2 is the AVD's alias for the host machine's loopback —
            // `localhost` from inside the emulator means the emulator itself.
            // Points at the local `docker compose up` stack (apps/api).
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3001\"")
        }
        release {
            isMinifyEnabled = false
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
    testImplementation("app.cash.turbine:turbine:1.1.0")
    testImplementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.1")

    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation(composeBom)
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
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
    "**/HttpUrlConnectionTransport*",
    "**/Routes*",
    "**/ComposableSingletons*",
    "**/*\$WhenMappings*",
)

tasks.register<JacocoReport>("jacocoDomainCoverage") {
    dependsOn("testDebugUnitTest")
    group = "verification"
    description = "Line coverage for Wave-1 domain code (excludes UI/platform glue)."

    reports {
        xml.required.set(true)
        html.required.set(true)
    }

    val classDir = layout.buildDirectory.dir("tmp/kotlin-classes/debug")
    classDirectories.setFrom(
        files(classDir).asFileTree.matching { exclude(domainCoverageExcludes) },
    )
    sourceDirectories.setFrom(files("src/main/kotlin"))
    executionData.setFrom(
        files(layout.buildDirectory.file("jacoco/testDebugUnitTest.exec")),
    )
}

tasks.withType<Test>().configureEach {
    extensions.configure(JacocoTaskExtension::class) {
        isIncludeNoLocationClasses = true
        excludes = listOf("jdk.internal.*")
    }
}
