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

async function readJSON(filePath) {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
}

async function calcFileSHA256(filePath) {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function validateStageRepo(pkgType, stageRepo, filePath) {
    assert(stageRepo && typeof stageRepo === "object", `Invalid submission object in ${filePath}`);
    assert(typeof stageRepo.url === "string" && /^[^/]+\/[^@]+@[0-9a-f]{7,}$/i.test(stageRepo.url), `Field "url" must look like owner/repo@hash in ${filePath}`);
    assert(typeof stageRepo.updated === "string" && stageRepo.updated.trim(), `Missing "updated" in ${filePath}`);
    assert(stageRepo.package && typeof stageRepo.package === "object", `Missing "package" in ${filePath}`);
    const pkg = stageRepo.package;
    assert(typeof pkg.name === "string" && pkg.name.trim(), `Missing package.name in ${filePath}`);
    assert(typeof pkg.version === "string" && /^\d+\.\d+\.\d+([\-+][0-9A-Za-z.\-]+)?$/.test(pkg.version), `Invalid package.version in ${filePath}`);
    assert(typeof pkg.minAppVersion === "string" && /^\d+\.\d+\.\d+([\-+][0-9A-Za-z.\-]+)?$/.test(pkg.minAppVersion), `Invalid package.minAppVersion in ${filePath}`);
    assert(typeof pkg.archiveSHA256 === "string" && /^[0-9a-f]{64}$/i.test(pkg.archiveSHA256), `Invalid package.archiveSHA256 in ${filePath}`);
    assert(pkg.displayName && typeof pkg.displayName === "object", `Missing package.displayName in ${filePath}`);
    assert(pkg.description && typeof pkg.description === "object", `Missing package.description in ${filePath}`);
    assert(typeof pkg.author === "string" && pkg.author.trim(), `Missing package.author in ${filePath}`);
    assert(typeof pkg.url === "string" && /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/i.test(pkg.url), `package.url must be a GitHub repository URL in ${filePath}`);
    if (pkgType === "plugins") {
        assert(Array.isArray(pkg.frontends) && pkg.frontends.length > 0, `Plugin package.frontends must be a non-empty array in ${filePath}`);
        assert(Array.isArray(pkg.backends) && pkg.backends.length > 0, `Plugin package.backends must be a non-empty array in ${filePath}`);
        assert(Array.isArray(pkg.permissions) && pkg.permissions.length > 0, `Plugin package.permissions must be a non-empty array in ${filePath}`);
    }
}

async function validateType(rootDir, pkgType, allowMissingPackages) {
    const submissionsDir = path.join(rootDir, "submissions", pkgType);
    if (!await exists(submissionsDir)) {
        return {count: 0};
    }
    const entries = await fs.readdir(submissionsDir, {withFileTypes: true});
    const seenNames = new Map();
    const seenRepos = new Map();
    let count = 0;
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) {
            continue;
        }
        const filePath = path.join(submissionsDir, entry.name);
        const stageRepo = await readJSON(filePath);
        validateStageRepo(pkgType, stageRepo, filePath);
        const pkg = stageRepo.package;
        const pkgName = stageRepo.package.name;
        const repoURLHash = stageRepo.url;
        if (seenNames.has(pkgName)) {
            throw new Error(`Duplicate package name "${pkgName}" in ${filePath} and ${seenNames.get(pkgName)}`);
        }
        if (seenRepos.has(repoURLHash)) {
            throw new Error(`Duplicate stage repo "${repoURLHash}" in ${filePath} and ${seenRepos.get(repoURLHash)}`);
        }
        seenNames.set(pkgName, filePath);
        seenRepos.set(repoURLHash, filePath);
        const archivePath = path.join(rootDir, "packages", "package", `${repoURLHash}.zip`);
        if (!allowMissingPackages) {
            assert(await exists(archivePath), `Missing package archive: ${archivePath}`);
            const actualSHA256 = await calcFileSHA256(archivePath);
            assert(actualSHA256.toLowerCase() === pkg.archiveSHA256.toLowerCase(), `Package archive SHA-256 mismatch for ${archivePath}`);
        }
        count++;
    }
    return {count};
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const rootDir = path.resolve(process.cwd(), args.root || args["source-root"] || "marketplace/sourceflow-bazaar");
    const allowMissingPackages = args["allow-missing-packages"] === "true";
    let total = 0;
    for (const pkgType of PACKAGE_TYPES) {
        const result = await validateType(rootDir, pkgType, allowMissingPackages);
        total += result.count;
    }
    console.log(`SourceFlow bazaar validation passed.`);
    console.log(`root: ${rootDir}`);
    console.log(`submissions: ${total}`);
    if (allowMissingPackages) {
        console.log(`package archive check: skipped`);
    }
}

main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
});
