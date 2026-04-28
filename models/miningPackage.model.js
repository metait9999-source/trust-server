const db = require("../config/db.config");

async function getAll() {
  const [rows] = await db.query(
    "SELECT * FROM mining_packages WHERE status = 1 ORDER BY duration_days ASC",
  );
  return rows;
}

async function getAllForAdmin() {
  const [rows] = await db.query(
    "SELECT * FROM mining_packages ORDER BY created_at DESC",
  );
  return rows;
}

async function getById(id) {
  const [rows] = await db.query("SELECT * FROM mining_packages WHERE id = ?", [
    id,
  ]);
  return rows[0];
}

async function create(data) {
  const [result] = await db.query("INSERT INTO mining_packages SET ?", data);
  return result.insertId;
}

async function update(id, data) {
  const [result] = await db.query("UPDATE mining_packages SET ? WHERE id = ?", [
    data,
    id,
  ]);
  return result.affectedRows;
}

async function remove(id) {
  const [result] = await db.query("DELETE FROM mining_packages WHERE id = ?", [
    id,
  ]);
  return result.affectedRows;
}

module.exports = { getAll, getAllForAdmin, getById, create, update, remove };
