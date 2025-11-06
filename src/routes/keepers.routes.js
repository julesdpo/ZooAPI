import { Router } from "express";
import { body, param, query, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { auth, requireRole } from "../middlewares/auth.js";
import { parsePagination, parseSort, pagedResponse } from "../utils/pagination.js";

const prisma = new PrismaClient();
const router = Router();


/**
 * @swagger
 * tags:
 *   name: Keepers
 *   description: Gestion des soigneurs (RBAC)
 */

/**
 * @swagger
 * /api/keepers:
 *   get:
 *     summary: Lister les soigneurs (admin)
 *     tags: [Keepers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [user, staff, admin] }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PagedResponse_KeeperPublic' }
 *       401: { description: Token requis }
 *       403: { description: Interdit (admin) }
 */

/**
 * @swagger
 * /api/keepers/me:
 *   get:
 *     summary: Récupérer mon profil
 *     tags: [Keepers]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/KeeperPublic' }
 *       401: { description: Token requis }
 */

/**
 * @swagger
 * /api/keepers/{id}:
 *   get:
 *     summary: Récupérer un soigneur (admin ou soi-même)
 *     tags: [Keepers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/KeeperPublic' }
 *       401: { description: Token requis }
 *       403: { description: Interdit }
 *       404: { description: Non trouvé }
 *
 *   put:
 *     summary: Modifier un soigneur (admin = tout ; sinon, soi-même champs limités)
 *     tags: [Keepers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/KeeperUpdateSelf'
 *               - $ref: '#/components/schemas/KeeperUpdateAdmin'
 *     responses:
 *       200: { description: Modifié }
 *       401: { description: Token requis }
 *       403: { description: Interdit }
 *       404: { description: Non trouvé }
 *
 *   delete:
 *     summary: Supprimer un soigneur (admin)
 *     tags: [Keepers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Supprimé }
 *       401: { description: Token requis }
 *       403: { description: Interdit }
 *       404: { description: Non trouvé }
 */

/**
 * @swagger
 * /api/keepers:
 *   post:
 *     summary: Créer un soigneur (admin)
 *     tags: [Keepers]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/KeeperCreate' }
 *     responses:
 *       201: { description: Créé }
 *       401: { description: Token requis }
 *       403: { description: Interdit }
 *       409: { description: Conflit email }
 *       422: { description: Données invalides }
 */

/**
 * GET /api/keepers
 * Admin uniquement : listage + recherche
 */
router.get(
  "/",
  auth,
  requireRole("admin"),
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("q").optional().isString().trim(),
    query("role").optional().isIn(["user", "staff", "admin"]),
    query("sort").optional().isString().isIn(["createdAt", "-createdAt", "lastName", "-lastName"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { page, limit, skip, take } = parsePagination(req);
    const sort = parseSort(req.query.sort, ["createdAt", "lastName"]);

    const where = {
      AND: [
        req.query.q
          ? {
              OR: [
                { email: { contains: req.query.q, mode: "insensitive" } },
                { firstName: { contains: req.query.q, mode: "insensitive" } },
                { lastName: { contains: req.query.q, mode: "insensitive" } },
              ],
            }
          : {},
        req.query.role ? { role: req.query.role } : {},
      ],
    };

    const [total, items] = await Promise.all([
      prisma.keeper.count({ where }),
      prisma.keeper.findMany({
        where,
        orderBy: sort,
        skip,
        take,
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, createdAt: true },
      }),
    ]);

    res.json(pagedResponse({ page, limit, total, data: items }));
  }
);

/**
 * GET /api/keepers/me
 * Profil de l'utilisateur connecté
 */
router.get("/me", auth, async (req, res) => {
  const me = await prisma.keeper.findUnique({
    where: { id: req.user.id },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, createdAt: true },
  });
  res.json(me);
});

/**
 * GET /api/keepers/:id
 * Admin ou soi-même
 */
router.get(
  "/:id",
  auth,
  [param("id").isInt({ min: 1 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const id = Number(req.params.id);
    if (req.user.role !== "admin" && req.user.id !== id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const user = await prisma.keeper.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: "Keeper not found" });
    res.json(user);
  }
);

/**
 * POST /api/keepers
 * Admin : créer un keeper (sans mot de passe ici — inscription = /auth/register)
 */
router.post(
  "/",
  auth,
  requireRole("admin"),
  [
    body("firstName").isString().trim().isLength({ min: 1 }),
    body("lastName").isString().trim().isLength({ min: 1 }),
    body("email").isEmail().normalizeEmail(),
    body("phone").optional().isString().trim(),
    body("role").optional().isIn(["user", "staff", "admin"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { firstName, lastName, email, phone, role } = req.body;

    const existing = await prisma.keeper.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already exists" });

    const created = await prisma.keeper.create({
      data: { firstName, lastName, email, phone, role: role ?? "user", passwordHash: "!" }, // placeholder (inscription classique via /auth/register)
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, createdAt: true },
    });

    res.status(201).json(created);
  }
);

/**
 * PUT /api/keepers/:id
 * Admin : peut tout modifier (sauf passwordHash ici)
 * User/staff : ne peuvent modifier que leur propre profil, champs autorisés
 */
router.put(
  "/:id",
  auth,
  [
    param("id").isInt({ min: 1 }),
    body("firstName").optional().isString().trim().isLength({ min: 1 }),
    body("lastName").optional().isString().trim().isLength({ min: 1 }),
    body("phone").optional().isString().trim(),
    body("role").optional().isIn(["user", "staff", "admin"]),
    body("email").optional().isEmail().normalizeEmail(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const id = Number(req.params.id);
    const isSelf = req.user.id === id;
    const isAdmin = req.user.role === "admin";

    if (!isSelf && !isAdmin) return res.status(403).json({ error: "Forbidden" });

    // Filtrer les champs autorisés si ce n'est pas un admin
    let data = req.body;
    if (!isAdmin) {
      const allowed = ["firstName", "lastName", "phone"];
      data = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    } else {
      // Admin : empêcher la modif du passwordHash ici
      delete data.passwordHash;
    }

    // Si email change, vérifier unicité
    if (data.email) {
      const dup = await prisma.keeper.findUnique({ where: { email: data.email } });
      if (dup && dup.id !== id) return res.status(409).json({ error: "Email already in use" });
    }

    const existing = await prisma.keeper.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Keeper not found" });

    const updated = await prisma.keeper.update({
      where: { id },
      data,
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, createdAt: true },
    });

    res.json(updated);
  }
);

/**
 * DELETE /api/keepers/:id
 * Admin uniquement
 */
router.delete(
  "/:id",
  auth,
  requireRole("admin"),
  [param("id").isInt({ min: 1 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const id = Number(req.params.id);
    const existing = await prisma.keeper.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Keeper not found" });

    await prisma.keeper.delete({ where: { id } });
    res.status(204).send();
  }
);

export default router;
