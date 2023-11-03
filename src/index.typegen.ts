// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  "@@xstate/typegen": true;
  internalEvents: {
    "done.invoke.clone": {
      type: "done.invoke.clone";
      data: unknown;
      __tip: "See the XState TS docs to learn how to strongly type this.";
    };
    "done.invoke.init": {
      type: "done.invoke.init";
      data: unknown;
      __tip: "See the XState TS docs to learn how to strongly type this.";
    };
    "done.invoke.pull": {
      type: "done.invoke.pull";
      data: unknown;
      __tip: "See the XState TS docs to learn how to strongly type this.";
    };
    "xstate.init": { type: "xstate.init" };
  };
  invokeSrcNameMap: {};
  missingImplementations: {
    actions: never;
    delays: never;
    guards: never;
    services: never;
  };
  eventsCausingActions: {};
  eventsCausingDelays: {};
  eventsCausingGuards: {};
  eventsCausingServices: {
    clone: "SELECT_REPO";
    getFiles: "done.invoke.clone" | "done.invoke.init" | "done.invoke.pull";
    init: "xstate.init";
    pull: "SYNC";
  };
  matchesStates:
    | "cloning"
    | "empty"
    | "gettingFiles"
    | "idle"
    | "initializing"
    | "pulling"
    | "unknownError";
  tags: never;
}
