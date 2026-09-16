import type { MockFileResult } from "./types";

interface MockFileNode {
  type: "file";
  sizeBytes: number;
}

export interface MockDirNode {
  type: "dir";
  children: Record<string, MockDirNode | MockFileNode>;
}

export type MockTreeRoot = Record<string, MockDirNode | MockFileNode>;

export function byteLength(content: string): number {
  return new TextEncoder().encode(content).length;
}

export function utf8File(content: string): MockFileResult {
  return { encoding: "utf8", content, sizeBytes: byteLength(content) };
}

export function fileNode(content: string): MockFileNode {
  return { type: "file", sizeBytes: byteLength(content) };
}

export function filesFromContent(map: Record<string, string>): Record<string, MockFileResult> {
  return Object.fromEntries(Object.entries(map).map(([path, content]) => [path, utf8File(content)]));
}
