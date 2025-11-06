import { Router } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { signToken } from "../middlewares/auth.js";
import { loginLimiter } from "../middlewares/rateLimiter.js";

const prisma = new PrismaClient();
const router = Router();

// validations d’entrée
const registerValidators = [
  body("firstName").isString().trim().isLength({ min: 1 }),
  body("lastName").isString().trim().isLength({ min: 1 }),
  body("email").isEmail().normalizeEmail(),
  body("password").isString().isLength({ min: 8 }), // 8+ caractères
];

router.post("/register", registerValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { firstName, lastName, email, password } = req.body;

  // email unique
  const existing = await prisma.keeper.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.keeper.create({
    data: { firstName, lastName, email, passwordHash, role: "user" },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true }
  });

  // token de bienvenue (optionnel mais pratique)
  const token = signToken({ id: user.id, email: user.email, role: user.role });

  return res.status(201).json({ user, token });
});

const loginValidators = [
  body("email").isEmail().normalizeEmail(),
  body("password").isString().isLength({ min: 8 }),
];

router.post("/login", loginLimiter, loginValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { email, password } = req.body;

  const user = await prisma.keeper.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ id: user.id, email: user.email, role: user.role });

  res.json({
    user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
    token,
  });
});

export default router;
