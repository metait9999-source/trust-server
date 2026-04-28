const db = require("../config/db.config");

// Get all active packages (for users)
async function getAll() {
  try {
    const [rows] = await db.query(
      "SELECT * FROM arbitrage_packages WHERE status = 1 ORDER BY duration_days ASC",
    );
    return rows;
  } catch (error) {
    throw new Error(error.message);
  }
}

// Get all packages including inactive (for admin)
async function getAllForAdmin() {
  try {
    const [rows] = await db.query(
      "SELECT * FROM arbitrage_packages ORDER BY created_at DESC",
    );
    return rows;
  } catch (error) {
    throw new Error(error.message);
  }
}

// Get single package by ID
async function getById(id) {
  try {
    const [rows] = await db.query(
      "SELECT * FROM arbitrage_packages WHERE id = ?",
      [id],
    );
    return rows[0];
  } catch (error) {
    throw new Error(error.message);
  }
}

// Create new package
async function create(data) {
  try {
    const [result] = await db.query(
      "INSERT INTO arbitrage_packages SET ?",
      data,
    );
    return result.insertId;
  } catch (error) {
    throw new Error(error.message);
  }
}

// Update package by ID
async function update(id, data) {
  try {
    const [result] = await db.query(
      "UPDATE arbitrage_packages SET ? WHERE id = ?",
      [data, id],
    );
    return result.affectedRows;
  } catch (error) {
    throw new Error(error.message);
  }
}

// Delete package by ID
async function remove(id) {
  try {
    const [result] = await db.query(
      "DELETE FROM arbitrage_packages WHERE id = ?",
      [id],
    );
    return result.affectedRows;
  } catch (error) {
    throw new Error(error.message);
  }
}

module.exports = { getAll, getAllForAdmin, getById, create, update, remove };
