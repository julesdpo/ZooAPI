import jwt from "jsonwebtoken";

export function signToken(payload, expiresIn = "1h") {
  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET");
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

export function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // ex: { id, email, role }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
