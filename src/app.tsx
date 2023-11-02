import git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import { FsaNodeFs } from "memfs/lib/fsa-to-node";
import { IFileSystemDirectoryHandle } from "memfs/lib/fsa/types";
import React from "react";

const REPO_DIR = "/repo";

// Reference: https://github.com/streamich/memfs/blob/c8bfa38aa15f1d3c9f326e9c25c8972326193a26/demo/git-opfs/main.ts
const rootDir =
  navigator.storage.getDirectory() as unknown as Promise<IFileSystemDirectoryHandle>;

const fs = new FsaNodeFs(rootDir);

init(fs);

async function init(fs: FsaNodeFs) {
  try {
    // This will throw if the directory doesn't exist
    console.log("Already cloned");
  } catch (error) {
    console.log("Cloning...");
    await git.clone({
      fs,
      http,
      dir: REPO_DIR,
      corsProxy: "https://cors.isomorphic-git.org",
      url: "https://github.com/lumen-notes/notes-template",
      ref: "main",
      singleBranch: true,
      depth: 10,
      // https://isomorphic-git.org/docs/en/onAuth
      // onAuth: () => ({ username: <token> }),
    });
  }
}

/** Recursively list contents of a directory */
async function* walk(
  dir: string,
  pattern: RegExp = /.*/
): AsyncGenerator<string> {
  const files = await fs.promises.readdir(dir);

  for (const file of files) {
    // Ignore .git directory
    if (file === ".git") continue;

    const path = `${dir}/${file}`;
    const stat = await fs.promises.stat(path);

    if (stat.isDirectory()) {
      yield* walk(path, pattern);
    } else if (stat.isFile() && pattern.test(file)) {
      yield path;
    }
  }
}

/** Convert a generator to an array */
async function toArray<T>(gen: AsyncGenerator<T>) {
  const arr: T[] = [];
  for await (const item of gen) {
    arr.push(item);
  }
  return arr;
}

export function App() {
  const [files, setFiles] = React.useState<string[]>([]);

  React.useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const files = await toArray(walk(REPO_DIR, /\.md$/));

        if (!ignore) {
          setFiles(files);
        }
      } catch (error) {
        if (!ignore) {
          console.error(error);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div>
      <pre>{JSON.stringify(files, null, 2)}</pre>
    </div>
  );
}
