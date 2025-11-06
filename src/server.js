import "dotenv/config";
import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import { corsOptions } from "./config/cors.js";
import { globalLimiter } from "./middlewares/rateLimiter.js";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import authRoutes from "./routes/auth.routes.js";
import { loginLimiter } from "./middlewares/rateLimiter.js";
import { auth, requireRole } from "./middlewares/auth.js";
import animalsRoutes from "./routes/animals.routes.js";
import enclosuresRoutes from "./routes/enclosures.routes.js";
import keepersRoutes from "./routes/keepers.routes.js";
import observationsRoutes from "./routes/observations.routes.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";
import { swaggerUi, swaggerSpec } from "./config/swagger.js";





const app = express();

app.use(express.json());       
app.use(morgan("dev"));        
app.use(helmet());             
app.use(cors(corsOptions));    
app.use(globalLimiter); 

app.use("/auth", authRoutes);
app.use("/api/auth", authRoutes);

app.use("/auth/login", loginLimiter);


app.get("/api/me", auth, (req, res) => {
  res.json({ me: req.user });
});

app.get("/api/admin/ping", auth, requireRole("admin"), (req, res) => {
  res.json({ ok: true });
});

app.use("/api/animals", animalsRoutes);
app.use("/api/enclosures", enclosuresRoutes);
app.use("/api/keepers", keepersRoutes);
app.use("/api/observations", observationsRoutes);

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "Zoo API Docs",
}));

/**
 * @swagger
 * /api/status:
 *   get:
 *     summary: Vérification de l'API
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: OK
 */


app.get("/api/status", async (req, res) => {
  try {
    const [animals, enclosures, keepers] = await Promise.all([
      prisma.animal.count(),
      prisma.enclosure.count(),
      prisma.keeper.count(),
    ]);
    res.json({ status: "ok", db: { animals, enclosures, keepers } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "db_error" });
  }
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
// Port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Zoo API listening on http://localhost:${PORT}`);
});

app.use(notFound);
app.use(errorHandler);