// models/user.model.js
const db = require("../config").db;

class User {
  // Get all users with optional role filtering
  static async getAll(role = null) {
    let query = "SELECT * FROM meta_ct_user";
    let queryParams = [];

    if (role) {
      query += " WHERE role = ?";
      queryParams.push(role);
    } else {
      query += " WHERE role IN (?, ?)";
      queryParams.push("admin", "superadmin");
    }

    const [rows] = await db.query(query, queryParams);
    return rows;
  }

  // Get a user by ID
  static async getById(id) {
    const [rows] = await db.query("SELECT * FROM meta_ct_user WHERE id = ?", [
      id,
    ]);
    return rows[0];
  }

  // Get a user by wallet address
  static async getByWalletId(wallet) {
    const [rows] = await db.query(
      "SELECT * FROM meta_ct_user WHERE user_wallet = ?",
      [wallet],
    );
    return rows[0];
  }

  // Get a user by uiid address
  static async getByUUId(uuid) {
    const [rows] = await db.query("SELECT * FROM meta_ct_user WHERE uuid = ?", [
      uuid,
    ]);
    return rows[0];
  }

  // Get a user by email or mobile
  static async getByEmailOrMobile(emailOrMobile) {
    const [rows] = await db.query(
      "SELECT * FROM meta_ct_user WHERE email = ? OR mobile = ?",
      [emailOrMobile, emailOrMobile],
    );
    return rows[0];
  }
  // Get a user by email or mobile for login (including password)
  static async getByEmailOrMobileWithPassword(emailOrMobile) {
    const query = `
      SELECT 
        u.*, 
        GROUP_CONCAT(p.label) AS permissions
      FROM 
        meta_ct_user u
      LEFT JOIN 
        user_permissions up ON u.id = up.user_id
      LEFT JOIN 
        permissions p ON up.permission_id = p.id
      WHERE 
        u.email = ? OR u.mobile = ?
      GROUP BY 
        u.id;
    `;

    const [rows] = await db.query(query, [emailOrMobile, emailOrMobile]);
    return rows[0];
  }

  // Create a new user
  static async create(userData) {
    const [result] = await db.query("INSERT INTO meta_ct_user SET ?", userData);
    return result.insertId;
  }

  // Update a user by ID
  static async update(id, userData) {
    const [result] = await db.query("UPDATE meta_ct_user SET ? WHERE id = ?", [
      userData,
      id,
    ]);
    return result.affectedRows;
  }

  // Delete a user by ID
  static async delete(id) {
    const [result] = await db.query("DELETE FROM meta_ct_user WHERE id = ?", [
      id,
    ]);
    return result.affectedRows;
  }
}

module.exports = User;
