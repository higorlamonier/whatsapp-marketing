import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { contactsRouter } from "./routes/contacts.routes.js";
import { campaignsRouter } from "./routes/campaigns.routes.js";
import { consultantsRouter } from "./routes/consultants.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { webhooksRouter } from "./routes/webhooks.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    }
  })
);
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "../public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/contacts", contactsRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/consultants", consultantsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/webhooks", webhooksRouter);
