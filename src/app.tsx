import git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import { FsaNodeFs } from "memfs/lib/fsa-to-node";
import { IFileSystemDirectoryHandle } from "memfs/lib/fsa/types";

// Reference: https://github.com/streamich/memfs/blob/c8bfa38aa15f1d3c9f326e9c25c8972326193a26/demo/git-opfs/main.ts
const rootDir =
  navigator.storage.getDirectory() as unknown as Promise<IFileSystemDirectoryHandle>;

const fs = new FsaNodeFs(rootDir);

init(fs);

async function init(fs: FsaNodeFs) {
  try {
    // This will throw if the directory doesn't exist
    const files = await fs.promises.readdir("/tmp");

    console.log("Already cloned");
    console.log(files);
  } catch (error) {
    console.log("Cloning...");

    await git.clone({
      fs,
      http,
      dir: "/tmp",
      corsProxy: "https://cors.isomorphic-git.org",
      url: "https://github.com/lumen-notes/notes-template",
      ref: "main",
      singleBranch: true,
      depth: 10,
      // https://isomorphic-git.org/docs/en/onAuth
      // onAuth: () => ({ username: <token> }),
    });

    const files = await fs.promises.readdir("/tmp");

    console.log(files);
  }
}

// TODO: Display list of files in OPFS

export function App() {
  return <div>Hello world</div>;
}
