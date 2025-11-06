export function parsePagination(req, { maxLimit = 100, defaultLimit = 10 } = {}) {
  const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit ?? String(defaultLimit), 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip, take: limit };
}

export function parseSort(sortRaw, allowed = ["species", "createdAt"]) {
  // ex: "species" ou "-createdAt"
  const key = (sortRaw || "createdAt").replace(/^-/, "");
  const dir = sortRaw?.startsWith("-") ? "desc" : "asc";
  if (!allowed.includes(key)) return { [allowed[0]]: "asc" };
  return { [key]: dir };
}

export function pagedResponse({ page, limit, total, data }) {
  return { page, limit, total, data };
}
