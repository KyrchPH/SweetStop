import cors from "cors";
import express from "express";

import { errorHandler } from "./middlewares/error-handler.js";
import { notFoundHandler } from "./middlewares/not-found-handler.js";
import { requestContext, requestLogger } from "./middlewares/request-context.js";
import apiRouter from "./routes/index.js";

const app = express();

app.set("trust proxy", true);
app.use(cors());
app.use(requestContext);
app.use(requestLogger);
app.use(express.json());

app.get("/health", (_, res) => {
  res.status(200).json({ status: "ok", service: "sweetstop-pos-server" });
});

app.use("/api/v1", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
