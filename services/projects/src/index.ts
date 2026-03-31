import express from "express";
import cors from "cors";
import { projectsRouter } from "./routes/projects";
import { tasksRouter } from "./routes/tasks";

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// Auth middleware stub: read X-User-Id header from gateway, attach to req
app.use((req: any, _res, next) => {
  const userId = req.headers['x-user-id'];
  if (userId && typeof userId === 'string') {
    req.userId = userId;
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "projects-service" });
});

app.use("/projects", projectsRouter);
app.use("/tasks", tasksRouter);

// Error handler - add after all routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Validation error', details: err.errors });
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Resource already exists' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Resource not found' });
    }
  }

  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Projects service running on port ${PORT}`);
});

export default app;
