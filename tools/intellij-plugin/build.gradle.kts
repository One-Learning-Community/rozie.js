import org.jetbrains.changelog.Changelog
import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType
import org.jetbrains.intellij.platform.gradle.TestFrameworkType
// NOTE: In IntelliJ Platform Gradle Plugin 2.x the GenerateLexerTask was relocated
// from the standalone `org.jetbrains.grammarkit.tasks` package into the bundled
// IPGP namespace. Verified by introspecting IPGP 2.16.0's jar (Rule 3 fix —
// RESEARCH.md A1 anticipated this drift; the actual class lives at this path).
import org.jetbrains.intellij.platform.gradle.tasks.GenerateLexerTask

plugins {
    id("org.jetbrains.kotlin.jvm") version "2.2.0"
    id("org.jetbrains.intellij.platform") version "2.16.0"
    id("org.jetbrains.intellij.platform.grammarkit") version "2.12.0"
    id("org.jetbrains.changelog") version "2.2.1"
}

group = providers.gradleProperty("pluginGroup").get()
version = providers.gradleProperty("pluginVersion").get()

kotlin {
    jvmToolchain(21)
}

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        // For 2024.2 floor we use intellijIdeaUltimate; the 2025.3+ unified `intellijIdea`
        // helper is not used here (RESEARCH Standard Stack note).
        intellijIdeaUltimate(providers.gradleProperty("platformVersion"))
        bundledPlugin("JavaScript")
        bundledPlugin("com.intellij.css")
        testFramework(TestFrameworkType.Platform)
    }
    testImplementation("junit:junit:4.13.2")
    // For D-07 TM <-> JFlex drift check (Plan 02 will use it; Plan 01 only verifies path resolution)
    testImplementation("org.json:json:20240303")
}

intellijPlatform {
    pluginConfiguration {
        id = "js.rozie.intellij"
        name = "Rozie.js"
        version = project.version.toString()
        ideaVersion {
            sinceBuild = "242"
            // upper-bound deliberately unset per Pitfall 7 — let plugin verifier gate forward compat
        }
        vendor {
            name = "Rozie.js"
            email = "internal@rozie.js"
        }
        description = """
            Internal dogfooding build — not for Marketplace distribution.
            Adds .rozie file type recognition with Rozie-aware syntax highlighting
            and JS/HTML/CSS language injection into block bodies.
        """.trimIndent()
    }

    pluginVerification {
        ides {
            // IPGP 2.16 renamed `ide(...)` to `create(...)` for plugin-verifier IDE entries
            // (verified by javap on IntelliJPlatformExtension$PluginVerification$Ides — Rule 3 fix).
            create(IntelliJPlatformType.IntellijIdeaUltimate, "2024.2.5")
            create(IntelliJPlatformType.IntellijIdeaUltimate, "2025.3")
        }
    }

    buildSearchableOptions = false
}

sourceSets {
    main {
        java {
            srcDirs("src/main/gen")
        }
    }
}

// Plan 02 will create src/main/jflex/Rozie.flex and wire compileKotlin dependsOn.
// We register the task here so A1 (parameter names) can be verified at scaffold time.
tasks.register<GenerateLexerTask>("generateRozieLexer") {
    sourceFile.set(file("src/main/jflex/Rozie.flex"))
    targetOutputDir.set(file("src/main/gen/js/rozie/intellij/lexer"))
    purgeOldFiles.set(true)
}

// NOTE: `tasks.named("compileKotlin") { dependsOn("generateRozieLexer") }` is deliberately
// NOT wired here — Rozie.flex does not exist yet (Plan 02 creates it). Wiring this now
// would fail compileKotlin. Plan 02 will add the wiring after creating the .flex file.

// Pitfall 10 mitigation: pass the absolute path to the TextMate grammar JSON as a
// system property so the D-07 drift check (Plan 02) can read it regardless of CWD.
tasks.test {
    systemProperty(
        "rozie.tmGrammarPath",
        "${rootProject.projectDir}/../textmate/syntaxes/rozie.tmLanguage.json"
    )
}
