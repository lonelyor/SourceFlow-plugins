#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PACKAGE_TYPES = ["plugins", "themes", "icons", "templates", "widgets"];

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const current = argv[i];
        if (!current.startsWith("--")) {
            continue;
        }
        const key = current.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith("--")) {
            args[key] = "true";
            continue;
        }
        args[key] = next;
        i++;
    }
    return args;
}

async function exists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function ensureDir(targetPath) {
    await fs.mkdir(targetPath, {recursive: true});
}

async function readJSON(filePath) {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
}

async function writeJSON(filePath, value) {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }
    if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
}

function validateStageRepo(pkgType, stageRepo, filePath) {
    if (!stageRepo || typeof stageRepo !== "object") {
        throw new Error(`Invalid stage repo in ${filePath}`);
    }
    if (typeof stageRepo.url !== "string" || !stageRepo.url.includes("@")) {
        throw new Error(`Field "url" must look like owner/repo@hash in ${filePath}`);
    }
    if (!stageRepo.package || typeof stageRepo.package !== "object") {
        throw new Error(`Missing "package" metadata in ${filePath}`);
    }
    if (typeof stageRepo.package.name !== "string" || !stageRepo.package.name.trim()) {
        throw new Error(`Missing package.name in ${filePath}`);
    }
    if (typeof stageRepo.package.version !== "string" || !stageRepo.package.version.trim()) {
        throw new Error(`Missing package.version in ${filePath}`);
    }
    if (typeof stageRepo.package.minAppVersion !== "string" || !stageRepo.package.minAppVersion.trim()) {
        throw new Error(`Missing package.minAppVersion in ${filePath}`);
    }
    if (pkgType === "plugins" && !Array.isArray(stageRepo.package.frontends)) {
        throw new Error(`Plugin package.frontends must be an array in ${filePath}`);
    }
}

async function readStageRepos(submissionDir, pkgType) {
    const typeDir = path.join(submissionDir, pkgType);
    if (!await exists(typeDir)) {
        return [];
    }
    const entries = await fs.readdir(typeDir, {withFileTypes: true});
    const repos = [];
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) {
            continue;
        }
        const filePath = path.join(typeDir, entry.name);
        const stageRepo = await readJSON(filePath);
        validateStageRepo(pkgType, stageRepo, filePath);
        repos.push(stageRepo);
    }
    repos.sort((left, right) => left.url.localeCompare(right.url));
    return repos;
}

async function copyDirIfExists(sourceDir, targetDir) {
    if (!await exists(sourceDir)) {
        return;
    }
    await fs.cp(sourceDir, targetDir, {recursive: true});
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const rootDir = path.resolve(process.cwd(), args.root || "marketplace/sourceflow-bazaar");
    const submissionDir = path.resolve(rootDir, args.submissions || "submissions");
    const outputDir = path.resolve(process.cwd(), args.output || path.join(rootDir, "dist"));
    const packagesDir = path.resolve(rootDir, args.packages || "packages");
    const statsFile = path.resolve(rootDir, args.stats || "stats/index.json");

    await fs.rm(outputDir, {recursive: true, force: true});
    await ensureDir(outputDir);

    const stageIndexes = {};
    for (const pkgType of PACKAGE_TYPES) {
        stageIndexes[pkgType] = {
            repos: await readStageRepos(submissionDir, pkgType),
        };
    }

    const bazaarHash = args.hash || crypto.createHash("sha1")
        .update(PACKAGE_TYPES.map((pkgType) => stableStringify(stageIndexes[pkgType])).join("\n"))
        .digest("hex");

    for (const pkgType of PACKAGE_TYPES) {
        const outputPath = path.join(outputDir, `bazaar@${bazaarHash}`, "stage", `${pkgType}.json`);
        await writeJSON(outputPath, stageIndexes[pkgType]);
    }

    const stats = await exists(statsFile) ? await readJSON(statsFile) : {};
    await writeJSON(path.join(outputDir, "stat", "bazaar", "index.json"), stats);
    await writeJSON(path.join(outputDir, "version.json"), {
        bazaar: bazaarHash,
        generatedAt: new Date().toISOString(),
        layout: {
            stage: `/bazaar@${bazaarHash}/stage/*.json`,
            packageArchive: "/package/<owner>/<repo>@<hash>.zip",
            packageAsset: "/package/<owner>/<repo>@<hash>/<asset>",
            stats: "/stat/bazaar/index.json",
        },
    });

    await copyDirIfExists(packagesDir, path.join(outputDir, "package"));

    console.log(`SourceFlow bazaar generated.`);
    console.log(`root: ${rootDir}`);
    console.log(`output: ${outputDir}`);
    console.log(`bazaar hash: ${bazaarHash}`);
}

main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
});
