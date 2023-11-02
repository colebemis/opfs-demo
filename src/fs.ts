import { FsaNodeFs } from "memfs/lib/fsa-to-node";
import { IFileSystemDirectoryHandle } from "memfs/lib/fsa/types";

// Reference: https://github.com/streamich/memfs/blob/c8bfa38aa15f1d3c9f326e9c25c8972326193a26/demo/git-opfs/main.ts
const rootDir =
  navigator.storage.getDirectory() as unknown as Promise<IFileSystemDirectoryHandle>;

export const fs = new FsaNodeFs(rootDir);
