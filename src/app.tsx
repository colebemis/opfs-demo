import { useMachine } from "@xstate/react";
import git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import LagRadar from "react-lag-radar";
import { assign, createMachine, fromPromise } from "xstate";
import { fs } from "./fs";

// TODO: Fix memfs Safari error: (await this.__getFileById(d,"writeFile")).createWritable is not a function.
// TODO: Check if memfs git-opfs demo works in Safari
// TODO: Configure synchronous fs adatper
// TODO: Run file system and git commands in a web worker to avoid blocking the UI thread

const ROOT_DIR = "/tmp";
const DEFAULT_BRANCH = "main";

type Context = {
  files: string[];
  error: Error | null;
};

type Event = { type: "SELECT_REPO"; repo: string };

const gitMachine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5RQJYBcB0KB26UEMAbFALxygGIIB7bMLbAN2oGt6d0BtABgF1FQAB2qw8tASAAeiAEzcAbBgUyArNwCcARhUAOTQHYZAFn0AaEAE9ER+UYyaAzDP06HOmQcOaAvt-OpMDjQCYjJsSjAAJ0jqSIxBQnw0ADNYgFsGLj4JYVFg8SQpWQUleVUNbT1DE3MrBAcDDBknHW5dHX0bNt9-dAwwNME0CwoAZQBRABlxgGEAFQB9ACVxgAUAeR5+QtyxbAlpBCMHO1UXGRl1GXkdIx0dWsQGlQx9Fu4HBXlNa4MekACGAAxoRaOQqLR2ExWPQQZCtjkRHsDoh9OpuPYVPJPoY9B5HvUPBh0WUVOpdD9NOodP9AXDcOEKFEYnEEklUpEMvSwAidkj8vtCoc0RjtNjuLjKQTPMSVA03DddDcaX4AX0UBBCGAxlNZosVhteUJ+SgCqBhejMeLJfjLLJ9JoMEZlPJ1J9ripHPpaX0AK7YFjYagAd2w42isR103myzWm2yfLypsF5tRlrFOJkeM0BL0GDU3ELxmuRgM8m9-yDEDgEgCiKTZqKCAAtPICa2lIWu92u1mfYFcMEiKRyPXkULrDICUY7hgHGT55pjg5Xe5+-1BsMxwKUfUTvYOmpWiprjczHb6ppFM0sx8vj9vhXeph6aPE+PUwh5NxHRoHPoAN0LRNAeC9LhkV4Wm0BwYLUTRtHXDUtW3ZNd3JRR1CuX51GOEwtAJE5FDcW8rivZ03iMdd-UDEMwwjSIUMbQ50OJLDvhwk40RzC8qTsQj-24S5qkcGRfF8IA */
  id: "git",
  types: {} as { context: Context; events: Event },
  context: {
    files: [],
    error: null,
  },
  initial: "initializing",
  states: {
    initializing: {
      invoke: {
        id: "init",
        src: fromPromise(async () => {
          const files = await git.listFiles({
            fs,
            dir: ROOT_DIR,
            ref: DEFAULT_BRANCH,
          });

          return { files };
        }),
        onDone: {
          target: "idle",
          actions: assign({
            files: ({ event }) => event.output.files as string[],
          }),
        },
        // If git.listFiles() fails, the repo is empty
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
        input: ({ event }) => {
          return { repo: event.repo };
        },
        src: fromPromise(async ({ input }) => {
          // Remove existing repo
          console.log(`$ rm -rf ${ROOT_DIR}`);
          await fs.promises.rm(ROOT_DIR, { recursive: true, force: true });

          // Clone repo
          console.log(
            `$ git clone https://github.com/${input.repo}.git ${ROOT_DIR}`
          );
          await git.clone({
            fs,
            http,
            dir: ROOT_DIR,
            corsProxy: "https://cors.isomorphic-git.org",
            url: `https://github.com/${input.repo}`,
            ref: DEFAULT_BRANCH,
            singleBranch: true,
            depth: 1,
            onMessage: console.log,
            // https://isomorphic-git.org/docs/en/onAuth
            // onAuth: () => ({}),
          });

          // List files
          // TODO: Investigate git.walk() as a more performant alternative to git.listFiles()
          const files = await git.listFiles({
            fs,
            dir: ROOT_DIR,
            ref: DEFAULT_BRANCH,
          });

          return files;
        }),
        onDone: {
          target: "idle",
          actions: assign({
            files: ({ event }) => event.output as string[],
          }),
        },
        onError: {
          target: "unknownError",
          actions: assign({
            error: ({ event }) => event.data as Error,
          }),
        },
      },
    },
    idle: {
      on: {
        SELECT_REPO: "cloning",
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

export function App() {
  const [state, send] = useMachine(gitMachine);

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
      <pre>Files: {JSON.stringify(state.context.files, null, 2)}</pre>
    </div>
  );
}
