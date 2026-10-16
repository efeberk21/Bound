import { createServer } from "node:http";
import { toolHandler } from "../packages/core/src/tools.js";
const handlers = {
  preview: toolHandler("bound.preview.v1"),
  content: toolHandler("bound.content.v1"),
};
let dropped = false;
const server = createServer((request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  const name = path.split("/")[2] as keyof typeof handlers;
  const handler = handlers[name];
  if (!handler) {
    response.writeHead(404).end();
    return;
  }
  if (process.env.BOUND_TEST_DROP_EXECUTE_RESPONSE === "1") {
    const end = response.end.bind(response);
    response.end = ((...args: Parameters<typeof end>) => {
      if (
        !dropped &&
        path.endsWith("/execute") &&
        response.statusCode === 200
      ) {
        dropped = true;
        response.destroy();
        return response;
      }
      return end(...args);
    }) as typeof response.end;
  }
  void handler(request, response);
});
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address !== "string")
    process.stdout.write(
      JSON.stringify({ url: `http://127.0.0.1:${address.port}/api/preview` }) +
        "\n",
    );
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
