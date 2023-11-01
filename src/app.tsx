import git from "isomorphic-git";
import FS from "@isomorphic-git/lightning-fs";
import http from "isomorphic-git/http/web";
import React from "react";
// import { Buffer } from "buffer";

// self.Buffer = Buffer;

const fs = new FS("fs").promises;

async function init() {
  try {
    const files = await fs.readdir("/tmp");
    console.log("already cloned");
    console.log(files);
  } catch (error) {
    console.error(error);
    await git.clone({
      fs,
      http,
      dir: "/tmp",
      corsProxy: "https://cors.isomorphic-git.org",
      url: "https://github.com/lumen-notes/notes-template",
      ref: "main",
      singleBranch: true,
      depth: 10,
    });
    const files = await fs.readdir("/tmp");
    console.log(files);
  }
}

export function App() {
  React.useEffect(() => {
    init();
  }, []);
  return <div>Hello world</div>;
}
