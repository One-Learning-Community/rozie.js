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
        //
        // Plan 08-05: -PplatformVersion=<version> overrides the gradle.properties value
        // (Gradle CLI -P properties shadow gradle.properties). The .orElse("2024.2.5")
        // makes the floor explicit if both sources are absent — the CI matrix passes
        // -PplatformVersion=2024.2.5 / 2025.3 to drive the parallel jobs.
        intellijIdeaUltimate(providers.gradleProperty("platformVersion").orElse("2024.2.5"))
        bundledPlugin("JavaScript")
        bundledPlugin("com.intellij.css")
        // LSP4IJ (Red Hat) — the LSP client the plugin uses to consume the
        // shared @rozie/language-server brain (Option C). 0.19.4 declares
        // since-build 242 with no upper bound, so it spans both platform legs
        // (2024.2.5 / 2025.3).
        plugin("com.redhat.devtools.lsp4ij", "0.19.4")
        testFramework(TestFrameworkType.Platform)
    }
    testImplementation("junit:junit:4.13.2")
    // Required for the 2024.2 testFramework: BasePlatformTestCase initialization throws
    // NoClassDefFoundError: org/opentest4j/AssertionFailedError without an explicit
    // opentest4j dep. RESEARCH.md "Supporting" table flagged this for <2024.3.
    // (Rule 3 fix — confirmed empirically by gradle test failure.)
    testImplementation("org.opentest4j:opentest4j:1.3.0")
}

intellijPlatform {
    pluginConfiguration {
        id = "js.rozie"
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
        // Explicit changeNotes (Rule 3 fix) — the changelog plugin's auto-render
        // path expects a CHANGELOG.md with an [Unreleased] section; we set the
        // value inline instead of carrying a CHANGELOG.md for this internal build.
        // Content mirrors plugin.xml <change-notes> verbatim (Plan 08.2-07
        // contract — both surfaces must stay in lockstep so the IDE shows the
        // same release summary regardless of which descriptor it reads).
        changeNotes = """
            <p><strong>0.3.0</strong> — Language constructs synced to Rozie grammar
            v0.2.0. New directives recognised in &lt;template&gt;:
            <code>r-match</code> / <code>r-case</code> / <code>r-default</code>
            (Phase 11 switch-style conditionals) — attribute-name completion and
            sigil coloring. New magic identifiers recognised in injected JS:
            <code>${'$'}el</code>, <code>${'$'}onUnmount</code>,
            <code>${'$'}portals</code>, <code>${'$'}classSelector</code> —
            completion, coloring, and synthetic ambient declarations. Dropped
            <code>${'$'}listeners</code> and <code>${'$'}expose</code> from the
            magic-identifier set: neither is a compiler-recognised identifier
            (<code>${'$'}expose</code> is a deferred v2 feature;
            <code>&lt;listeners&gt;</code> is a block, not a sigil).</p>
            <p><strong>0.3.0</strong> (editor) — Modifier autocomplete: typing a
            <code>.</code> in an <code>@event</code> / <code>r-on:event</code> /
            <code>r-model</code> attribute now offers the event composition
            modifiers, the key/button filters (on keyboard events), and the
            three <code>r-model</code> modifiers. SFC block folding:
            <code>&lt;template&gt;</code>, <code>&lt;script&gt;</code>,
            <code>&lt;style&gt;</code> and the other blocks collapse to a
            one-line placeholder. Quick documentation: Ctrl-Q / hover on an
            <code>r-*</code> directive, a modifier, or a <code>${'$'}</code>-magic
            identifier now shows inline docs. Inspection: a typo'd
            <code>r-*</code> directive or <code>.modifier</code> is flagged
            with a "did you mean" rename quick-fix. Structure view: a
            <code>.rozie</code> file's SFC blocks appear in the Structure
            tool window for quick navigation. New-file action: "New &gt;
            Rozie Component" scaffolds a <code>.rozie</code> single-file
            component. Inspection: assigning to a non-<code>model</code> prop
            (<code>${'$'}props.x = …</code>) is flagged as a ROZ200 error.</p>
            <p><strong>0.2.0</strong> — Architectural pivot to injection-first model.
            HTML coloring inside &lt;template&gt; now matches the TextMate bundle.
            Smart navigation: ${'$'}props.X / ${'$'}data.X / ${'$'}refs.X Go-to-Declaration.
            Color-scheme keys removed (no longer in use): ROZIE_EVENT_AT,
            ROZIE_EVENT_NAME, ROZIE_MODIFIER, ROZIE_MODIFIER_PUNCTUATION,
            ROZIE_PROP_BINDING_PUNCT, ROZIE_PROP_BINDING_NAME, ROZIE_INTERPOLATION_DELIM,
            ROZIE_REF_ATTR, ROZIE_HTML_ATTR_NAME, ROZIE_COMPONENT_REF,
            ROZIE_DIRECTIVE_COLON, ROZIE_DIRECTIVE_ARG, ROZIE_SLOT_FILL_MARKER,
            ROZIE_SLOT_NAME, ROZIE_SLOT_BRACKET. Users who customised these will see
            them revert to default HTML coloring — expected since v0.1.0 was internal
            dogfooding only.</p>
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

// Plan 02 created src/main/jflex/Rozie.flex; the task generates _RozieLexer.java
// into src/main/gen/. compileKotlin and compileJava both depend on the
// generation step so adding/editing Rozie.flex automatically refreshes the
// generated source.
tasks.register<GenerateLexerTask>("generateRozieLexer") {
    sourceFile.set(file("src/main/jflex/Rozie.flex"))
    targetOutputDir.set(file("src/main/gen/js/rozie/intellij/lexer"))
    purgeOldFiles.set(true)
}

tasks.named("compileKotlin") { dependsOn("generateRozieLexer") }
tasks.named("compileJava") { dependsOn("generateRozieLexer") }

// ---------------------------------------------------------------------------
// Zero-config language-server bundling (Option C).
//
// The plugin can ship the standalone @rozie/language-server bundle inside its
// resources at /language-server/server-standalone.cjs; RozieLanguageServerProvider
// extracts and spawns it with no user setup. The bundle is a build artifact of
// the `@rozie/language-server` package (pnpm), so we copy the prebuilt file into
// a generated resources dir that's wired into the main resource set.
//
// Graceful by design (preserves the Node-free CI plugin build): the copy is
// `onlyIf` the prebuilt bundle exists, and the pnpm (re)build runs only under
// `-PbuildServer`. When no bundle is present the plugin simply ships without a
// server and the provider disables the LSP — exactly today's behavior.
// ---------------------------------------------------------------------------
val repoRoot = layout.projectDirectory.dir("../..")
val serverBundleFile =
    repoRoot.file("packages/language-server/dist-standalone/server-standalone.cjs")
val generatedResourcesDir = layout.buildDirectory.dir("generated-resources")

val buildLanguageServerBundle =
    tasks.register<Exec>("buildLanguageServerBundle") {
        description = "Build the standalone @rozie/language-server bundle via pnpm (opt-in: -PbuildServer)."
        workingDir = repoRoot.asFile
        commandLine("pnpm", "--filter", "@rozie/language-server", "build:standalone")
        // Opt-in only — keeps `node`/`pnpm` off the default (CI) build's path.
        onlyIf { project.hasProperty("buildServer") }
    }

val bundleLanguageServer =
    tasks.register<Copy>("bundleLanguageServer") {
        description = "Stage the language-server bundle into plugin resources (no-op when absent)."
        dependsOn(buildLanguageServerBundle)
        from(serverBundleFile)
        into(generatedResourcesDir.map { it.dir("language-server") })
        // No bundle (Node-free CI) → copy nothing → plugin ships server-less.
        onlyIf { serverBundleFile.asFile.exists() }
    }

sourceSets {
    main {
        resources {
            srcDir(generatedResourcesDir)
        }
    }
}

tasks.named("processResources") { dependsOn(bundleLanguageServer) }
