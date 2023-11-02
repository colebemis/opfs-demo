import { useMachine } from "@xstate/react";
import git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import LagRadar from "react-lag-radar";
import { assign, createMachine, fromPromise } from "xstate";
import { fs } from "./fs";

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
  /** @xstate-layout N4IgpgJg5mDOIC5RQJYBcB0KB26UEMAbFALxygGIIB7bMLbAN2oGt6d0BtABgF1FQAB2qw8tASAAeiAEzcAbBgUyArAEYZAFgDM8lds0KANCACeiTfM0Y12mQA4ZVlfe4B2ewE43AXx8nUTA40AmIybEowACco6iiMQUJ8NAAzOIBbBi4+CWFREPEkKVkFJXlVDR09A2MzRFs1Gyd9XRV5Tzs-APQMMHTBNFMKAGUAUQAZUYBhABUAfQAlUYAFAHkefiK8sWwJaQQda1UPNw61T1VtNRNzBA1PDHK9TTU3eW5tbheZLpBAjAAxoRaOQqLR2ExWPQgeCNrkRDs9ohTtwbG1dKd5Lp7Jp7DdEHZGp5lNoXNxuN53PJfv8YbgIhRorF4olkmkopk6WA4VsEQVdkV9ii0Vj5Jjsbj8Xc3G4MJ59JVdNxbCoVDSeigIIQwCMJtN5ks1jyhHyUIVQELiSKMZ5RTi8XUEDI3I1DOUZA4FJpNJ57OrMABXbAsbDUADu2FGMTiusms0WK3WOV5+TNAotyKtanRYttEs8UvsjRU5NL8ns8nkah0fn8IFDEDgEkC8NT5uKCAAtPIpZ2VHLPIOh8Oh9p-VkQkRSORW4jBRYZFKNKj7G99FZ7C5PvY-XX-n0BrcTW30x3tAYbKvVVWZOdiYvHbZURpnq93p9vuO6TOU3OMwh3kaCltHsAwi2VNx9CXUonhUNw5HPTxszUNRx01bVZ35JEEHlRRBw9QwXDFbgVClAxFBA518J0HExz3HogxDcNI2jKJMLTbDcIHAiSIrNwSKXWwlBUQcSPPPQ1EcXc-CAA */
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
