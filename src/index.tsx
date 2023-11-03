import git, { WORKDIR } from "isomorphic-git";
import http from "isomorphic-git/http/web";
import { atom, useAtom, useAtomValue } from "jotai";
import { atomWithMachine } from "jotai-xstate";
import React from "react";
import ReactDOM from "react-dom/client";
import LagRadar from "react-lag-radar";
import { assign, createMachine } from "xstate";
import { fs, fsWipe } from "./fs";
import "./index.css";

// TODO: Run file system and git commands in a web worker to avoid blocking the UI thread

const ROOT_DIR = "/root";
const DEFAULT_BRANCH = "main";

type Context = {
  repo: string;
  markdownFiles: Record<string, string>;
  error: Error | null;
};

type Event = { type: "SELECT_REPO"; repo: string } | { type: "SYNC" };

function createGitMachine() {
  return createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5RQJYBcB0KB26UEMAbFALxygGIIB7bMLbAN2oGt6d0BtABgF1FQAB2qw8tASAAeiAEwBGORm4A2GQFZu3AOwyALFp0BmGQBoQAT0S6AnIYzGZ17gA41c5zpkyAvt7OpMDjQCYjJsSjAAJ0jqSIxBQnw0ADNYgFsGLj4JYVFg8SQpWQUlVQ1tPQMZYzNLBGVuOzljZwVDXVanOV9-dAwwNME0cwoAZQBRABlxgGEAFQB9ACVxgAUAeR5+QtyxbAlpBDdFQydlN1bnQzUr2sQGxWUWxu5HazUtax6QAIwAY0ItHIVFo7CYrHoANBWxyIj2B0QWlcGGUyl0cjUjhuukMWjuCBxWgw1kcyi0pzkWie3C+fh+fShuHCFCiMTiCSSqUiGUZYBhOzh+X2hUOCm0KPUFWUchxNnxhnaGB0zQ+5N0r1Uum+v2IsGC4QAYihCHAQXQGMw2BhdWgjSbYPyhIKUAVQIdjvYzhd3NdbhZZO8lY0VYZtGprKplNq+jbyHbTazYvFEil0taUHr4w7sgK8i7hW7EB7TipvVcboZ8ecZBhmjJLl4qTIXNHAhATWMprNFisNo6QLshQiEFTFDpUdxdDZqh9nPj1HZ62jzs5rM0SS26b8UO2wGMAJoAORm-cH+eHHxraOcujJmKeN3nujUGGbhjkzbkNNs7TUrfiACuhDEMyNDmjglr0IIQGEKezqukUCDyIoKiShU+hGKY-oEs+GDOF4TjWO8WiYoYrj-tBwHAom7IplyGSUbBOZOnmCGHMhpRoToGHVFhdStBg5SaDSH5Ip8f5bn0AHYCw2DUAA7tg4zRLEnbTPMyxrJszEDvBBaIWKRJlFKMrtNY85ka+yj4e0zRyNY+gRr4dJyRAcASAEsKsfphwALTKPivkvkRIWhWFhj-kEISkOQXnwiKVh8UWKhKDY+jqHWwb-gMQx1Cx8WFgguK6PYejVNcnx6NKVavLWzyhm8Hy0r0mCMrFuYFYhtjOIJZTStYWg4u8SVIW4KLSre5zcB+Kiov+saGsa7kdUOCVFboNYtDKChIuqt74jiygYOqmrvmSDnOM4kW7nFq2FWSPVeNWRFIg5uLzmodhImiajhk2X5qFGkmYIx7X5XdiEbfOXivsGCqA1+DkyEDLUYNJskKUpKmRLd55rR+DnHdKiPokiZGVthCgvvegOkeSchohFzlAA */
    id: "git",
    tsTypes: {} as import("./index.typegen").Typegen0,
    schema: {} as { context: Context; events: Event },
    context: {
      repo: "",
      markdownFiles: {},
      error: null,
    },
    initial: "initializing",
    states: {
      initializing: {
        invoke: {
          id: "init",
          src: async () => {
            const remoteOriginUrl = await git.getConfig({
              fs,
              dir: ROOT_DIR,
              path: "remote.origin.url",
            });

            // Remove https://github.com/ from the beginning of the URL to get the repo name
            const repo = String(remoteOriginUrl).replace(
              /^https:\/\/github.com\//,
              ""
            );
            return { repo };
          },
          onDone: {
            target: "gettingFiles",
            actions: assign({
              repo: (_, event) => event.data.repo as string,
            }),
          },
          onError: "empty",
        },
      },
      empty: {
        on: {
          SELECT_REPO: "cloning",
        },
      },
      cloning: {
        invoke: {
          id: "clone",
          src: async (_, event) => {
            if (!("repo" in event)) throw new Error("No repo selected");

            const repo = event.repo;

            // Wipe file system
            // TODO: Only remove the repo directory instead of wiping the entire file system
            // Blocked by https://github.com/isomorphic-git/lightning-fs/issues/71
            fsWipe();

            // Clone repo
            console.log(
              `$ git clone https://github.com/${repo}.git ${ROOT_DIR}`
            );
            await git.clone({
              fs,
              http,
              dir: ROOT_DIR,
              corsProxy: "https://cors.isomorphic-git.org",
              url: `https://github.com/${repo}`,
              ref: DEFAULT_BRANCH,
              singleBranch: true,
              depth: 1,
              onMessage: console.log,
              // https://isomorphic-git.org/docs/en/onAuth
              // onAuth: () => ({}),
            });

            return { repo };
          },
          onDone: {
            target: "gettingFiles",
            actions: [
              assign({
                repo: (_, event) => event.data.repo as string,
              }),
            ],
          },
          onError: {
            target: "unknownError",
            actions: assign({
              error: (_, event) => event.data as Error,
              repo: "",
              markdownFiles: {},
            }),
          },
        },
      },
      gettingFiles: {
        invoke: {
          id: "getFiles",
          src: async () => {
            const markdownFiles = await git.walk({
              fs,
              dir: ROOT_DIR,
              trees: [WORKDIR()],
              map: async (filepath, [entry]) => {
                // Ignore .git directory
                if (filepath.startsWith(".git")) return;

                // Ignore non-markdown files
                if (!filepath.endsWith(".md")) return;

                // Get file content
                const content = await entry?.content();

                if (!content) return null;

                return [
                  filepath.replace(/\.md$/, ""),
                  new TextDecoder().decode(content),
                ];
              },
            });

            return { markdownFiles: Object.fromEntries(markdownFiles) };
          },
          onDone: {
            target: "idle",
            actions: [
              assign({
                markdownFiles: (_, event) =>
                  event.data.markdownFiles as Record<string, string>,
              }),
            ],
          },
          onError: {
            target: "unknownError",
            actions: assign({
              error: (_, event) => event.data as Error,
            }),
          },
        },
      },
      idle: {
        on: {
          SELECT_REPO: "cloning",
          SYNC: "pulling",
        },
      },
      pulling: {
        invoke: {
          id: "pull",
          src: async () => {
            // Pull from GitHub
            console.log(`$ git pull`);
            await git.pull({
              fs,
              http,
              dir: ROOT_DIR,
              corsProxy: "https://cors.isomorphic-git.org",
              singleBranch: true,
              author: {
                // TODO: Don't hardcode these values
                name: "Cole Bemis",
                email: "colebemis@github.com",
              },
              onMessage: console.log,
              // https://isomorphic-git.org/docs/en/onAuth
              // onAuth: () => ({}),
            });
          },
          onDone: {
            target: "gettingFiles",
          },
          onError: {
            target: "unknownError",
            actions: assign({
              error: (_, event) => event.data as Error,
            }),
          },
        },
      },
      unknownError: {
        on: {
          SELECT_REPO: {
            target: "cloning",
            actions: assign({ error: null }),
          },
        },
      },
    },
  });
}

const gitMachineAtom = atomWithMachine(createGitMachine);

type Note = {
  id: string;
  content: string;
};

const notesAtom = atom<Note[]>((get) => {
  const state = get(gitMachineAtom);
  return Object.entries(state.context.markdownFiles).map(([id, content]) => ({
    id,
    content,
  }));
});

export function App() {
  const [state, send] = useAtom(gitMachineAtom);
  const notes = useAtomValue(notesAtom);

  return (
    <div>
      <LagRadar />
      <pre>State: {state.value.toString()}</pre>
      {state.context.error ? (
        <pre>Error: {state.context.error.message}</pre>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const repo = formData.get("repo");
          send({ type: "SELECT_REPO", repo: String(repo) });
        }}
      >
        <input
          type="text"
          name="repo"
          defaultValue="colebemis/hello-world"
          required
          pattern=".+\/.+" // Must contain a slash
        />
        <button type="submit">Select</button>
      </form>
      {state.matches("idle") ? (
        <button onClick={() => send({ type: "SYNC" })}>Sync</button>
      ) : null}
      <pre>Repo: {state.context.repo}</pre>
      <pre>
        Markdown files: {JSON.stringify(state.context.markdownFiles, null, 2)}
      </pre>
      <pre>Notes: {JSON.stringify(notes, null, 2)}</pre>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
