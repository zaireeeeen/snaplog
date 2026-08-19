export function checkKey(req, res) {
  const expected = process.env.SNAPLOG_KEY;
  if (!expected) {
    res.status(500).json({ error: "SNAPLOG_KEY is not configured" });
    return false;
  }
  const got = req.headers["x-snaplog-key"];
  if (got !== expected) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}
