import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { createExplainRouter } from "./routeExplain";
import { OpenAIExplainClient } from "./openaiClient";

const port = Number.parseInt(process.env.PORT || "8787", 10);
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const apiKey = process.env.OPENAI_API_KEY || "";

const client = apiKey
  ? new OpenAIExplainClient({
      apiKey,
      model
    })
  : null;

const app = express();

app.use((request: Request, response: Response, next: NextFunction) => {
  const origin = request.headers.origin;
  if (origin) {
    response.header("Access-Control-Allow-Origin", origin);
  } else {
    response.header("Access-Control-Allow-Origin", "*");
  }

  response.header("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers, Access-Control-Request-Private-Network");
  response.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (request.headers["access-control-request-private-network"] === "true") {
    response.header("Access-Control-Allow-Private-Network", "true");
  }

  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
});

app.use(cors({
  origin: true
}));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request: Request, response: Response) => {
  response.json({
    ok: true,
    service: "equation-explainer-backend",
    ready: Boolean(client),
    model
  });
});

app.use(createExplainRouter({ client }));

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown server error";
  console.error(error);
  response.status(500).json({
    error: "Unhandled server error.",
    message
  });
});

app.listen(port, () => {
  console.log(
    `Equation explainer backend listening on http://localhost:${port} (model=${model}, ready=${Boolean(client)})`
  );
});
