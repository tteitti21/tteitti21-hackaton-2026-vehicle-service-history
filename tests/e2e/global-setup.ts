import { createServer } from "node:http";

import next from "next";

const hostname = "127.0.0.1";
const port = 3000;

export default async function globalSetup() {
  const app = next({
    dev: false,
    dir: process.cwd(),
    hostname,
    port,
  });

  await app.prepare();

  const handle = app.getRequestHandler();
  const server = createServer((request, response) => {
    void handle(request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, hostname, () => {
      server.off("error", reject);
      resolve();
    });
  });

  return async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    await app.close();
  };
}
