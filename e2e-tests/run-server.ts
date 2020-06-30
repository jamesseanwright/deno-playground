import * as cp from "child_process";
import * as path from "path";

type TestSuiteGlobal = NodeJS.Global & {
  serverProc: cp.ChildProcess;
};

const testSuiteGlobal = global as unknown as TestSuiteGlobal;

export function runServer() {
  return new Promise((resolve, reject) => {
    if (!testSuiteGlobal.serverProc) {
      testSuiteGlobal.serverProc = cp.spawn("deno", ["run", "--allow-net", "example/index.ts"], {
        cwd: path.resolve(__dirname, '..'),
      });

      testSuiteGlobal.serverProc.stdout.on("data", (data: Buffer) => {
        if (data.toString().includes("Listening for requests on :8000...")) {
          resolve();
        }
      });

      testSuiteGlobal.serverProc.on('error', reject);

      return;
    }

    resolve();
  });
}

export function killServer() {
  testSuiteGlobal.serverProc?.kill();
}