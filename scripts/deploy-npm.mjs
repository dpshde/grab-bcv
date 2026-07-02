#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

function readPackageJson() {
  return JSON.parse(readFileSync("package.json", "utf8"));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });

  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    throw new Error(output || `${command} ${args.join(" ")} failed`);
  }

  return (result.stdout ?? "").trim();
}

function getPublishedVersion(packageName) {
  try {
    return runCapture("npm", ["view", packageName, "version"]);
  } catch (error) {
    const message = String(error?.message ?? "");
    if (message.includes("E404") || message.includes("404")) {
      return null;
    }
    throw error;
  }
}

function getTfaMode() {
  try {
    const profile = JSON.parse(runCapture("npm", ["profile", "get", "--json"]));
    return profile?.tfa?.mode ?? null;
  } catch {
    return null;
  }
}

function hasUsableNpmrcToken() {
  const candidates = new Set([
    resolve(process.cwd(), ".npmrc"),
    resolve(homedir(), ".npmrc")
  ]);

  if (process.env.npm_config_userconfig) {
    candidates.add(resolve(process.env.npm_config_userconfig));
  }

  for (const npmrcPath of candidates) {
    if (!existsSync(npmrcPath)) continue;

    const content = readFileSync(npmrcPath, "utf8");
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line.startsWith("//registry.npmjs.org/:_authToken=")) continue;

      const tokenValue = line.split("=").slice(1).join("=").trim();
      if (!tokenValue) continue;

      const envRef = tokenValue.match(/^\$\{([^}]+)\}$/);
      if (envRef) {
        const envName = envRef[1];
        if (process.env[envName]) return true;
        continue;
      }

      return true;
    }
  }

  return false;
}

function ensureWriteAuthPreflight() {
  const tfaMode = getTfaMode();
  const hasOtp = Boolean(process.env.NPM_OTP);
  const hasToken = Boolean(process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN);
  const hasNpmrcToken = hasUsableNpmrcToken();

  if (tfaMode === "auth-and-writes" && !hasOtp && !hasToken && !hasNpmrcToken) {
    console.error("Publish blocked: npm account requires a write factor.");
    console.error("Passkey-only cannot satisfy npm CLI publish auth.");
    console.error("Provide either:");
    console.error("  - NPM_TOKEN/NODE_AUTH_TOKEN (token with bypass_2fa=true), or");
    console.error("  - NPM_OTP=<6-digit-code> for this publish.");
    process.exit(1);
  }
}

function publishToNpm() {
  const baseArgs = ["publish", "--access", "public", "--ignore-scripts"];
  const otp = process.env.NPM_OTP;
  const args = otp ? [...baseArgs, `--otp=${otp}`] : baseArgs;
  const env = { ...process.env };

  if (env.NPM_TOKEN && !env.NODE_AUTH_TOKEN) {
    env.NODE_AUTH_TOKEN = env.NPM_TOKEN;
  }

  const result = spawnSync("npm", args, {
    env,
    stdio: "inherit"
  });

  return result.status ?? 1;
}

function revertVersion(version) {
  run("npm", ["version", version, "--no-git-tag-version", "--allow-same-version"]);
}

function main() {
  ensureWriteAuthPreflight();

  const pkgBefore = readPackageJson();
  const packageName = pkgBefore.name;
  const localVersionBefore = pkgBefore.version;
  const publishedVersionBefore = getPublishedVersion(packageName);

  let bumped = false;

  if (publishedVersionBefore === localVersionBefore) {
    run("npm", ["version", "patch", "--no-git-tag-version"]);
    bumped = true;
  }

  const status = publishToNpm();
  if (status === 0) {
    const pkgAfter = readPackageJson();
    console.log(`Published ${packageName}@${pkgAfter.version}`);
    return;
  }

  if (bumped) {
    const pkgAfterFailure = readPackageJson();
    const publishedAfterFailure = getPublishedVersion(packageName);
    if (publishedAfterFailure !== pkgAfterFailure.version) {
      revertVersion(localVersionBefore);
      console.error(`Publish failed; reverted version to ${localVersionBefore}.`);
    }
  }

  process.exit(status);
}

main();
