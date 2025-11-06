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
 *   name: Animals
 *   description: Gestion des animaux
 */

/**
 * @swagger
 * /api/animals:
 *   get:
 *     summary: Liste paginée des animaux
 *     tags: [Animals]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: species
 *         schema: { type: string }
 *       - in: query
 *         name: enclosure
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [species, -species, createdAt, -createdAt] }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PagedResponse_Animal' }
 *
 *   post:
 *     summary: Créer un animal
 *     tags: [Animals]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AnimalCreate' }
 *     responses:
 *       201: { description: Créé }
 *       401: { description: Token requis }
 *       422: { description: Données invalides }
 */

/**
 * @swagger
 * /api/animals/{id}:
 *   get:
 *     summary: Détail d'un animal
 *     tags: [Animals]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Animal' }
 *       404: { description: Non trouvé }
 *
 *   put:
 *     summary: Modifier un animal
 *     tags: [Animals]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AnimalUpdate' }
 *     responses:
 *       200: { description: Modifié }
 *       401: { description: Token requis }
 *       404: { description: Non trouvé }
 *       422: { description: Données invalides }
 *
 *   delete:
 *     summary: Supprimer un animal (admin)
 *     tags: [Animals]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Supprimé }
 *       401: { description: Token requis }
 *       403: { description: Interdit (admin uniquement) }
 *       404: { description: Non trouvé }
 */

/**
 * GET /api/animals
 * Query: page, limit, q (name/species), species, enclosure, sort (species|-createdAt)
 */
router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("q").optional().isString().trim(),
    query("species").optional().isString().trim(),
    query("enclosure").optional().isInt({ min: 1 }),
    query("sort").optional().isString().isIn(["species", "-species", "createdAt", "-createdAt"])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { page, limit, skip, take } = parsePagination(req);
    const sort = parseSort(req.query.sort, ["species", "createdAt"]);

    const where = {
      AND: [
        req.query.q
          ? {
              OR: [
                { name: { contains: req.query.q, mode: "insensitive" } },
                { species: { contains: req.query.q, mode: "insensitive" } },
              ],
            }
          : {},
        req.query.species ? { species: { equals: req.query.species } } : {},
        req.query.enclosure ? { enclosureId: Number(req.query.enclosure) } : {},
      ],
    };

    const [total, items] = await Promise.all([
      prisma.animal.count({ where }),
      prisma.animal.findMany({
        where,
        orderBy: sort,
        skip,
        take,
        include: { enclosure: { select: { id: true, name: true, biome: true } } },
      }),
    ]);

    res.json(pagedResponse({ page, limit, total, data: items }));
  }
);

/**
 * GET /api/animals/:id
 */
router.get(
  "/:id",
  [param("id").isInt({ min: 1 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const id = Number(req.params.id);
    const animal = await prisma.animal.findUnique({
      where: { id },
      include: { enclosure: { select: { id: true, name: true, biome: true } } },
    });
    if (!animal) return res.status(404).json({ error: "Animal not found" });
    res.json(animal);
  }
);

/**
 * POST /api/animals  (protégé)
 */
router.post(
  "/",
  auth, // n'importe quel user connecté peut créer (tu peux passer à requireRole('staff','admin') si tu veux)
  [
    body("name").isString().trim().isLength({ min: 1 }),
    body("species").isString().trim().isLength({ min: 1 }),
    body("sex").optional().isIn(["M", "F", "Unknown"]),
    body("birthDate").optional().isISO8601(),
    body("diet").optional().isIn(["herbivore", "carnivore", "omnivore"]),
    body("notes").optional().isString(),
    body("enclosureId").optional().isInt({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { name, species, sex, birthDate, diet, notes, enclosureId } = req.body;

    try {
      const created = await prisma.animal.create({
        data: {
          name,
          species,
          sex,
          birthDate: birthDate ? new Date(birthDate) : undefined,
          diet,
          notes,
          enclosureId,
        },
      });
      return res.status(201).json(created);
    } catch (e) {
      // contrainte unique sur name si tu l’ajoutes plus tard
      return res.status(400).json({ error: "Unable to create animal" });
    }
  }
);

/**
 * PUT /api/animals/:id  (protégé)
 */
router.put(
  "/:id",
  auth,
  [
    param("id").isInt({ min: 1 }),
    body("name").optional().isString().trim().isLength({ min: 1 }),
    body("species").optional().isString().trim().isLength({ min: 1 }),
    body("sex").optional().isIn(["M", "F", "Unknown"]),
    body("birthDate").optional().isISO8601(),
    body("diet").optional().isIn(["herbivore", "carnivore", "omnivore"]),
    body("notes").optional().isString(),
    body("enclosureId").optional().isInt({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const id = Number(req.params.id);
    const data = { ...req.body };
    if (data.birthDate) data.birthDate = new Date(data.birthDate);

    const existing = await prisma.animal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Animal not found" });

    const updated = await prisma.animal.update({ where: { id }, data });
    res.json(updated);
  }
);

/**
 * DELETE /api/animals/:id  (admin)
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
    const existing = await prisma.animal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Animal not found" });

    await prisma.animal.delete({ where: { id } });
    res.status(204).send();
  }
);

export default router;

