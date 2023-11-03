import { useMachine } from "@xstate/react";
import git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import LagRadar from "react-lag-radar";
import { assign, createMachine, fromPromise } from "xstate";
import { fs, fsWipe } from "./fs";

// TODO: Run file system and git commands in a web worker to avoid blocking the UI thread

const ROOT_DIR = "/root";
const DEFAULT_BRANCH = "main";

type Context = {
  repo: string;
  files: string[];
  error: Error | null;
};

type Event = { type: "SELECT_REPO"; repo: string };

const gitMachine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5RQJYBcB0KB26UEMAbFALxygGIIB7bMLbAN2oGt6d0BtABgF1FQAB2qw8tASAAeiAEzcAbBgUyArNwCcARhUAOTQHYZAFn0AaEAE9ER+UYyaAzDP06HOmQcOaAvt-OpMDjQCYjJsSjAAJ0jqSIxBQnw0ADNYgFsGLj4JYVFg8SQpWQUleVUNbT1DE3MrBAcDDBknHW5dHX0bNt9-dAwwNME0CwoAZQBRABlxgGEAFQB9ACVxgAUAeR5+QtyxbAlpBCMHO1UXGRl1GXkdIx0dWsQGlQx9Fu4HBXlNa4MekACGAAxoRaOQqLR2ExWPQQZCtjkRHsDoh9OpuPYVPJPoY9B5HvUPBh0WUVOpdD9NOodP9AXDcOEKFEYnEEklUpEMvSwAidkj8vtCoc0RjtNjuLjKQTPMSVA03DddDcaX4AX0UBBCGAxlNZosVhteUJ+SgCqBhejMeLJfjLLJ9JoMEZlPJ1J9ripHPpaX0AK7YFjYagAd2w42isR103myzWm2yfLypsF5tRlrFOJkeM0BL0GDU3ELxmuRgM8m9-yDEDgEgCiKTZqKCAAtPICa2lIWu92u1mfYFcMEiKRyPXkULrDICUY7hgHGT55pjg5Xe5+-1BsMxwKUfUTvYOmpWiprjczHb6ppFM0sx8vj9vhXeph6aPE+PUwh5NxHRoHPoAN0LRNAeC9LhkV4Wm0BwYLUTRtHXDUtW3ZNd3JRR1CuX51GOEwtAJE5FDcW8rivZ03iMdd-UDEMwwjSIUMbQ50OJLDvhwk40RzC8qTsQj-24S5qkcGRfF8IA */
  id: "git",
  types: {} as { context: Context; events: Event },
  context: {
    repo: "",
    files: [],
    error: null,
  },
  initial: "initializing",
  states: {
    initializing: {
      invoke: {
        id: "init",
        src: fromPromise(async () => {
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

          const files = await git.listFiles({
            fs,
            dir: ROOT_DIR,
            ref: DEFAULT_BRANCH,
          });

          return { repo, files };
        }),
        onDone: {
          target: "idle",
          actions: assign({
            repo: ({ event }) => event.output.repo as string,
            files: ({ event }) => event.output.files as string[],
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
        input: ({ event }) => ({ repo: event.repo }),
        src: fromPromise(async ({ input }) => {
          const repo = input.repo;

          // Wipe file system
          // TODO: Only remove the repo directory instead of wiping the entire file system
          // Blocked by https://github.com/isomorphic-git/lightning-fs/issues/71
          fsWipe();

          // Clone repo
          console.log(`$ git clone https://github.com/${repo}.git ${ROOT_DIR}`);
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

          return { repo, files };
        }),
        onDone: {
          target: "idle",
          actions: [
            assign({
              repo: ({ event }) => event.output.repo as string,
              files: ({ event }) => event.output.files as string[],
            }),
          ],
        },
        onError: {
          target: "unknownError",
          actions: assign({
            error: ({ event }) => event.data as Error,
            repo: "",
            files: [],
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
      <pre>Repo: {state.context.repo}</pre>
      <pre>Files: {JSON.stringify(state.context.files, null, 2)}</pre>
    </div>
  );
}
