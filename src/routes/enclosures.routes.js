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
 *   name: Enclosures
 *   description: Gestion des enclos
 */

/**
 * @swagger
 * /api/enclosures:
 *   get:
 *     summary: Liste paginée des enclos
 *     tags: [Enclosures]
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
 *         name: biome
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [name, -name, createdAt, -createdAt] }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PagedResponse_Enclosure' }
 *
 *   post:
 *     summary: Créer un enclos (staff/admin)
 *     tags: [Enclosures]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/EnclosureCreate' }
 *     responses:
 *       201: { description: Créé }
 *       401: { description: Token requis }
 *       403: { description: Interdit (staff/admin) }
 *       422: { description: Données invalides }
 */

/**
 * @swagger
 * /api/enclosures/{id}:
 *   get:
 *     summary: Détail d'un enclos
 *     tags: [Enclosures]
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
 *             schema: { $ref: '#/components/schemas/Enclosure' }
 *       404: { description: Non trouvé }
 *
 *   put:
 *     summary: Modifier un enclos (staff/admin)
 *     tags: [Enclosures]
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
 *           schema: { $ref: '#/components/schemas/EnclosureUpdate' }
 *     responses:
 *       200: { description: Modifié }
 *       401: { description: Token requis }
 *       403: { description: Interdit }
 *       404: { description: Non trouvé }
 *       422: { description: Données invalides }
 *
 *   delete:
 *     summary: Supprimer un enclos (admin)
 *     tags: [Enclosures]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Supprimé }
 *       401: { description: Token requis }
 *       403: { description: Interdit (admin) }
 *       404: { description: Non trouvé }
 */

/**
 * GET /api/enclosures
 * Query: page, limit, q (name), biome, sort (name|-createdAt)
 */
router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("q").optional().isString().trim(),
    query("biome").optional().isString().trim(),
    query("sort").optional().isString().isIn(["name", "-name", "createdAt", "-createdAt"])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { page, limit, skip, take } = parsePagination(req);
    const sort = parseSort(req.query.sort, ["name", "createdAt"]);

    const where = {
      AND: [
        req.query.q ? { name: { contains: req.query.q, mode: "insensitive" } } : {},
        req.query.biome ? { biome: { equals: req.query.biome } } : {},
      ],
    };

    const [total, items] = await Promise.all([
      prisma.enclosure.count({ where }),
      prisma.enclosure.findMany({
        where,
        orderBy: sort,
        skip,
        take,
        include: { animals: { select: { id: true, name: true, species: true } } },
      }),
    ]);

    res.json(pagedResponse({ page, limit, total, data: items }));
  }
);

/**
 * GET /api/enclosures/:id
 */
router.get(
  "/:id",
  [param("id").isInt({ min: 1 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const id = Number(req.params.id);
    const enclosure = await prisma.enclosure.findUnique({
      where: { id },
      include: { animals: { select: { id: true, name: true, species: true } } },
    });
    if (!enclosure) return res.status(404).json({ error: "Enclosure not found" });
    res.json(enclosure);
  }
);

/**
 * POST /api/enclosures  (protégé: staff/admin)
 */
router.post(
  "/",
  auth,
  requireRole("staff", "admin"),
  [
    body("name").isString().trim().isLength({ min: 1 }),
    body("biome").isString().trim().isLength({ min: 1 }),
    body("area_m2").isFloat({ gt: 0 }),
    body("capacity").isInt({ min: 0 }),
    body("temperatureTarget").optional().isFloat(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { name, biome, area_m2, capacity, temperatureTarget } = req.body;

    try {
      const created = await prisma.enclosure.create({
        data: { name, biome, area_m2, capacity, temperatureTarget },
      });
      return res.status(201).json(created);
    } catch (e) {
      // Contrainte unique (name)
      return res.status(409).json({ error: "Enclosure name already exists" });
    }
  }
);

/**
 * PUT /api/enclosures/:id  (protégé: staff/admin)
 */
router.put(
  "/:id",
  auth,
  requireRole("staff", "admin"),
  [
    param("id").isInt({ min: 1 }),
    body("name").optional().isString().trim().isLength({ min: 1 }),
    body("biome").optional().isString().trim().isLength({ min: 1 }),
    body("area_m2").optional().isFloat({ gt: 0 }),
    body("capacity").optional().isInt({ min: 0 }),
    body("temperatureTarget").optional().isFloat(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const id = Number(req.params.id);
    const existing = await prisma.enclosure.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Enclosure not found" });

    try {
      const updated = await prisma.enclosure.update({ where: { id }, data: req.body });
      res.json(updated);
    } catch {
      res.status(409).json({ error: "Name conflict" });
    }
  }
);

/**
 * DELETE /api/enclosures/:id  (admin only)
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
    const existing = await prisma.enclosure.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Enclosure not found" });

    await prisma.enclosure.delete({ where: { id } });
    res.status(204).send();
  }
);

export default router;
