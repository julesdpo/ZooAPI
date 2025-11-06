import { Router } from "express";
import { body, param, query, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { auth, requireRole } from "../middlewares/auth.js";
import { parsePagination, parseSort, pagedResponse } from "../utils/pagination.js";

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/observations
 * Filtrage: animalId, keeperId, riskLevel, dateStart, dateEnd
 */
router.get(
  "/",
  auth,
  [
    query("animalId").optional().isInt({ min: 1 }),
    query("keeperId").optional().isInt({ min: 1 }),
    query("riskLevel").optional().isInt({ min: 0, max: 5 }),
    query("dateStart").optional().isISO8601(),
    query("dateEnd").optional().isISO8601(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { page, limit, skip, take } = parsePagination(req);
    const sort = parseSort(req.query.sort ?? "-date", ["date", "createdAt"]);

    const where = {
      AND: [
        req.query.animalId ? { animalId: Number(req.query.animalId) } : {},
        req.query.keeperId ? { keeperId: Number(req.query.keeperId) } : {},
        req.query.riskLevel ? { riskLevel: Number(req.query.riskLevel) } : {},
        req.query.dateStart ? { date: { gte: new Date(req.query.dateStart) } } : {},
        req.query.dateEnd ? { date: { lte: new Date(req.query.dateEnd) } } : {},
      ],
    };

    const [total, items] = await Promise.all([
      prisma.observation.count({ where }),
      prisma.observation.findMany({
        where,
        skip,
        take,
        orderBy: sort,
        include: {
          animal: { select: { id: true, name: true, species: true } },
          keeper: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      }),
    ]);

    res.json(pagedResponse({ page, limit, total, data: items }));
  }
);

/**
 * GET /api/observations/:id
 */
router.get(
  "/:id",
  auth,
  [param("id").isInt({ min: 1 })],
  async (req, res) => {
    const id = Number(req.params.id);
    const observation = await prisma.observation.findUnique({
      where: { id },
      include: {
        animal: { select: { id: true, name: true, species: true } },
        keeper: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!observation) return res.status(404).json({ error: "Observation not found" });
    res.json(observation);
  }
);

/**
 * POST /api/observations
 * Seuls les staff/admin peuvent créer
 */
router.post(
  "/",
  auth,
  requireRole("staff", "admin"),
  [
    body("animalId").isInt({ min: 1 }),
    body("content").isString().trim().isLength({ min: 5 }),
    body("riskLevel").optional().isInt({ min: 0, max: 5 }),
    body("date").optional().isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { animalId, content, riskLevel, date } = req.body;

    const created = await prisma.observation.create({
      data: {
        animalId,
        content,
        riskLevel,
        date: date ? new Date(date) : new Date(),
        keeperId: req.user.id,
      },
    });

    res.status(201).json(created);
  }
);


/**
 * @swagger
 * tags:
 *   name: Observations
 *   description: Observations d'animaux (liées à un keeper)
 */

/**
 * @swagger
 * /api/observations:
 *   get:
 *     summary: Lister les observations (filtrable)
 *     tags: [Observations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: animalId
 *         schema: { type: integer }
 *       - in: query
 *         name: keeperId
 *         schema: { type: integer }
 *       - in: query
 *         name: riskLevel
 *         schema: { type: integer, minimum: 0, maximum: 5 }
 *       - in: query
 *         name: dateStart
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: dateEnd
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PagedResponse_Observation' }
 *       401: { description: Token requis }
 *
 *   post:
 *     summary: Créer une observation (staff/admin)
 *     tags: [Observations]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ObservationCreate' }
 *     responses:
 *       201: { description: Créée }
 *       401: { description: Token requis }
 *       403: { description: Interdit (staff/admin) }
 *       404: { description: Animal non trouvé }
 *       422: { description: Données invalides }
 */

/**
 * @swagger
 * /api/observations/{id}:
 *   get:
 *     summary: Détail d'une observation
 *     tags: [Observations]
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
 *             schema: { $ref: '#/components/schemas/Observation' }
 *       401: { description: Token requis }
 *       404: { description: Non trouvée }
 *
 *   put:
 *     summary: Modifier une observation (auteur ou staff/admin)
 *     tags: [Observations]
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
 *           schema: { $ref: '#/components/schemas/ObservationUpdate' }
 *     responses:
 *       200: { description: Modifiée }
 *       401: { description: Token requis }
 *       403: { description: Interdit }
 *       404: { description: Non trouvée }
 *
 *   delete:
 *     summary: Supprimer une observation (admin)
 *     tags: [Observations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Supprimée }
 *       401: { description: Token requis }
 *       403: { description: Interdit }
 *       404: { description: Non trouvée }
 */


/**
 * PUT /api/observations/:id
 * Staff/admin, ou le keeper auteur
 */
router.put(
  "/:id",
  auth,
  [
    param("id").isInt({ min: 1 }),
    body("content").optional().isString().isLength({ min: 5 }),
    body("riskLevel").optional().isInt({ min: 0, max: 5 }),  ],
  async (req, res) => {
    const id = Number(req.params.id);
const observation = await prisma.observation.findUnique({ where: { id } });
if (!observation) return res.status(404).json({ error: "Observation not found" });

// auteur ou staff/admin (comme tu avais déjà)
if (req.user.id !== observation.keeperId && req.user.role === "user") {
  return res.status(403).json({ error: "Forbidden" });
}

const data = { ...req.body };
if (data.riskLevel !== undefined) data.riskLevel = Number(data.riskLevel);

const updated = await prisma.observation.update({ where: { id }, data });
res.json(updated);
  }
);

/**
 * DELETE /api/observations/:id
 * Admin uniquement
 */
router.delete(
  "/:id",
  auth,
  requireRole("admin"),
  [param("id").isInt({ min: 1 })],
  async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.observation.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Observation not found" });
    await prisma.observation.delete({ where: { id } });
    res.status(204).send();
  }
);

export default router;
