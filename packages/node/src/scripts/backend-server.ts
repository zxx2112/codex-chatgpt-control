import { runBackendStdioServer } from "../backend/stdio-server.js";

await runBackendStdioServer({
  input: process.stdin,
  output: process.stdout,
  error: process.stderr
});
