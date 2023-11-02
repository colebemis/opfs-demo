import { useMachine } from "@xstate/react";
import git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import { createMachine, fromPromise, assign } from "xstate";
import { fs } from "./fs";

// TODO: Run file system and git commands in a web worker to avoid blocking the UI thread

const ROOT_DIR = "/tmp";

type Context = {
  error: Error | null;
};

type Event = { type: "SELECT_REPO"; repo: string };

const gitMachine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5RQJYBcB0YC2AHNAngMQDCAMgPIByAogNoAMAuoqLgPazorsB2rIAB6IAtAEYAzBjEMArABYAbAA4A7LIA0IAogBM82RlWqJ8ieoC+FrakwBjADZ8UvKEQh8wGFwDd2Aay9HT0YWJBAOLjQefnDhBF1FeQxZBlVlMV1NbUQATl0rG3QMYN4XNzAAJ0r2SoxcBwBDNAAzWuwSp14wUIFI7j4BeMTk1PTM7J0Ehl0Uq2sQXnYIOAFbPs4B2NB4kUUxaTklNUnRRUKQWyw8Qg2omKHEZRStKbFZVSMxE4ur0vK7ltHggGK89LlRr9iigIA4wIDooM4oh0hgJLllGZ1GCEGIMXMFlcAK68fxLADuvBo1VqCIeyIQ8l0OIyBKsQA */
  id: "git",
  types: {} as { context: Context; events: Event },
  context: {
    error: null,
  },
  initial: "empty",
  states: {
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
          // Clean up previous clone
          console.log(`$ rm -rf ${ROOT_DIR}`);
          await fs.promises.rm(ROOT_DIR, { recursive: true, force: true });

          // Clone the repo
          console.log(
            `$ git clone https://github.com/${input.repo}.git ${ROOT_DIR}`
          );
          await git.clone({
            fs,
            http,
            dir: ROOT_DIR,
            corsProxy: "https://cors.isomorphic-git.org",
            url: `https://github.com/${input.repo}`,
            ref: "main",
            singleBranch: true,
            depth: 1,
            onMessage: console.log,
            // https://isomorphic-git.org/docs/en/onAuth
            // onAuth: () => ({}),
          });
        }),
        onDone: "idle",
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
      <pre>{JSON.stringify(state.value)}</pre>
      {state.context.error ? (
        <pre>Error: {state.context.error.message}</pre>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const repo = formData.get("repo");
          send({ type: "SELECT_REPO", repo: `${repo}` });
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
    </div>
  );
}
