#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "summit-spark.js"), "utf8");
const errors = [];

function extractArray(name) {
  const needle = "const " + name + " = ";
  const start = source.indexOf(needle);
  if (start === -1) throw new Error("Missing " + name);
  const arrayStart = source.indexOf("[", start);
  if (arrayStart === -1) throw new Error("Missing array for " + name);
  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;
  for (let i = arrayStart; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === "[") depth += 1;
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        return Function("\"use strict\"; return (" + source.slice(arrayStart, i + 1) + ");")();
      }
    }
  }
  throw new Error("Unclosed array for " + name);
}

const maps = extractArray("maps");
const targets = extractArray("ROOM_TARGETS");
const names = extractArray("ROOM_NAMES");
const colsMatch = source.match(/const COLS = (\d+);/);
const rowsMatch = source.match(/const ROWS = (\d+);/);
const cols = colsMatch ? Number(colsMatch[1]) : 30;
const rows = rowsMatch ? Number(rowsMatch[1]) : 17;
const allowed = new Set(".#^v<>SLRAPTHUBM".split(""));
let goalCount = 0;
let startCount = 0;

function isPassable(tile) {
  return tile !== "#" && tile !== "^" && tile !== "v" && tile !== "<" && tile !== ">";
}

function hasLeftGap(room) {
  return room.some((line) => isPassable(line[0]));
}

function hasRightGap(room) {
  return room.some((line) => isPassable(line[cols - 1]));
}

if (maps.length !== targets.length) errors.push("ROOM_TARGETS has " + targets.length + ", maps has " + maps.length);
if (maps.length !== names.length) errors.push("ROOM_NAMES has " + names.length + ", maps has " + maps.length);

maps.forEach((room, roomIndex) => {
  if (!Array.isArray(room)) {
    errors.push("room " + (roomIndex + 1) + " is not an array");
    return;
  }
  if (room.length !== rows) errors.push("room " + (roomIndex + 1) + " has " + room.length + " rows, expected " + rows);
  if (roomIndex > 0 && !hasLeftGap(room)) errors.push("room " + (roomIndex + 1) + " has no left entry gap");
  if (roomIndex < maps.length - 1 && !hasRightGap(room)) errors.push("room " + (roomIndex + 1) + " has no right exit gap");
  room.forEach((line, y) => {
    if (typeof line !== "string") {
      errors.push("room " + (roomIndex + 1) + " row " + (y + 1) + " is not a string");
      return;
    }
    if (line.length !== cols) {
      errors.push("room " + (roomIndex + 1) + " row " + (y + 1) + " has " + line.length + " cols, expected " + cols);
    }
    [...line].forEach((tile, x) => {
      if (!allowed.has(tile)) errors.push("room " + (roomIndex + 1) + " has unknown tile \"" + tile + "\" at " + (x + 1) + "," + (y + 1));
      if (tile === "S") startCount += 1;
      if (tile === "H") goalCount += 1;
    });
  });
});

if (startCount !== 1) errors.push("expected exactly one S start, found " + startCount);
if (goalCount !== 1) errors.push("expected exactly one H summit goal, found " + goalCount);
if (!maps[maps.length - 1]?.some((line) => line.includes("H"))) errors.push("summit goal H must be in the final room");

for (let i = 0; i < targets.length; i += 1) {
  if (!(targets[i] > 0)) errors.push("target " + (i + 1) + " must be positive");
  if (typeof names[i] !== "string" || names[i].length === 0) errors.push("room name " + (i + 1) + " is empty");
}

if (errors.length > 0) {
  console.error("Map check failed:");
  for (const error of errors) console.error("- " + error);
  process.exit(1);
}

console.log("Map check passed: " + maps.length + " rooms, " + cols + "x" + rows + ", " + targets.length + " targets.");
