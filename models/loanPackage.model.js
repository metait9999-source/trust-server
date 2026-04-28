const db = require("../config/db.config");

async function getAll() {
  const [rows] = await db.query(
    "SELECT * FROM loan_packages WHERE status = 1 ORDER BY period_days ASC",
  );
  return rows;
}

async function getAllForAdmin() {
  const [rows] = await db.query(
    "SELECT * FROM loan_packages ORDER BY period_days ASC",
  );
  return rows;
}

async function getById(id) {
  const [rows] = await db.query("SELECT * FROM loan_packages WHERE id = ?", [
    id,
  ]);
  return rows[0];
}

async function create(data) {
  const [result] = await db.query("INSERT INTO loan_packages SET ?", data);
  return result.insertId;
}

async function update(id, data) {
  const [result] = await db.query("UPDATE loan_packages SET ? WHERE id = ?", [
    data,
    id,
  ]);
  return result.affectedRows;
}

async function remove(id) {
  const [result] = await db.query("DELETE FROM loan_packages WHERE id = ?", [
    id,
  ]);
  return result.affectedRows;
}

module.exports = { getAll, getAllForAdmin, getById, create, update, remove };
