export function notFound(req, res, next) {
  res.status(404).json({ error: "Route not found" });
}

export function errorHandler(err, req, res, next) {
  // Prisma known errors
  if (err?.code === "P2002") { // unique constraint
    return res.status(409).json({ error: "Unique constraint violation" });
  }
  if (err?.code === "P2025") { // record not found
    return res.status(404).json({ error: "Resource not found" });
  }

  // Validation déjà traitée dans les routes (422)
  // Fallback
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
}

