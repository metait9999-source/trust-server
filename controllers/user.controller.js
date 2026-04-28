const bcrypt = require("bcrypt");
const User = require("../models/user.model");

// Get all users
exports.getAllUsers = async (req, res) => {
  const { role } = req.query;

  try {
    const users = await User.getAll(role);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.getById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserByWalletId = async (req, res) => {
  try {
    const user = await User.getByWalletId(req.params.wallet);
    if (!user) return res.status(404).json({ error: "User not found" });

    // ✅ Check passcode BEFORE destructuring
    const hasPasscode = !!user.passcode;

    const { passcode, password, ...rest } = user;

    res.json({
      ...rest,
      passcode_set: hasPasscode, // ✅ now correctly true/false
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Sign up a new user
exports.signUpUser = async (req, res) => {
  try {
    const { email, mobile, password, ...rest } = req.body;

    // Check if the email or mobile already exists
    const existingUser = await User.getByEmailOrMobile(email || mobile);
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User already exists with this email or mobile" });
    }

    // Generate a unique 6-digit UUID
    let uuid;
    let isUnique = false;

    while (!isUnique) {
      uuid = Math.floor(100000 + Math.random() * 900000).toString();
      const userWithUuid = await User.getByUUId(uuid);
      if (!userWithUuid) {
        isUnique = true;
      }
    }

    // Hash the password if provided
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    // Create the new user
    const newUserId = await User.create({
      uuid,
      email,
      mobile,
      password: hashedPassword,
      ...rest,
    });
    res.status(201).json({ id: newUserId, ...req.body, password: undefined });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createUserByWallet = async (req, res) => {
  try {
    const { user_wallet, ...rest } = req.body;

    const existingUser = await User.getByWalletId(user_wallet);
    if (existingUser) {
      // User exists — return status so frontend knows
      return res.status(200).json({
        exists: true,
        has_passcode: !!existingUser.passcode,
        id: existingUser.id,
        uuid: existingUser.uuid,
        status: existingUser.status,
      });
    }

    // Generate unique 6-digit UUID
    let uuid;
    let isUnique = false;
    while (!isUnique) {
      uuid = Math.floor(100000 + Math.random() * 900000).toString();
      const userWithUuid = await User.getByUUId(uuid);
      if (!userWithUuid) isUnique = true;
    }

    // Create user without passcode yet
    const newUserId = await User.create({ uuid, user_wallet, ...rest });
    res.status(201).json({
      exists: false,
      has_passcode: false,
      id: newUserId,
      uuid,
      user_wallet,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.setPasscode = async (req, res) => {
  try {
    const { user_wallet, passcode } = req.body;

    if (!passcode || passcode.length !== 6 || !/^\d{6}$/.test(passcode)) {
      return res
        .status(400)
        .json({ error: "Passcode must be exactly 6 digits" });
    }

    const user = await User.getByWalletId(user_wallet);
    if (!user) return res.status(404).json({ error: "User not found" });

    // ✅ Allow setting passcode regardless — just overwrite
    // This handles edge case where previous attempt partially failed
    const hashed = await bcrypt.hash(passcode, 10);
    await User.update(user.id, { passcode: hashed });

    const { passcode: _, password: __, ...userData } = user;
    res.json({
      message: "Passcode set successfully",
      id: user.id,
      uuid: user.uuid,
      user: { ...userData, passcode_set: true },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Verify passcode
exports.verifyPasscode = async (req, res) => {
  try {
    const { user_wallet, passcode } = req.body;

    if (!passcode)
      return res.status(400).json({ error: "Passcode is required" });

    const user = await User.getByWalletId(user_wallet);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.passcode)
      return res.status(400).json({ error: "No passcode set" });

    const match = await bcrypt.compare(passcode, user.passcode);
    if (!match) return res.status(401).json({ error: "Incorrect passcode" });

    // Return full user data on success
    const { passcode: _, password: __, ...userData } = user;
    res.json({ verified: true, user: userData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Login user
exports.loginUser = async (req, res) => {
  try {
    const { emailOrMobile, password } = req.body;

    // Get the user by email or mobile
    const user = await User.getByEmailOrMobileWithPassword(emailOrMobile);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check the password if provided
    if (password) {
      console.log(password, user.password);
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Incorrect password" });
      }
    }

    // Parse permissions string into an array
    const permissionsArray = user.permissions
      ? user.permissions.split(",")
      : [];

    // Return user data (excluding password) with permissions array
    const { password: userPassword, ...userData } = user;
    res.json({ ...userData, permissions: permissionsArray });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a user by ID
exports.updateUser = async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    // Hash the password if provided
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    const affectedRows = await User.update(req.params.id, {
      password: hashedPassword,
      ...rest,
    });
    if (affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "User updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a user by ID
exports.deleteUser = async (req, res) => {
  try {
    const affectedRows = await User.delete(req.params.id);
    if (affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
