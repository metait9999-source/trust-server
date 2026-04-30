const ChatFaq = require("../models/chatFaq.model");

// ── User: get root FAQs ───────────────────────────────────────
exports.getRootFaqs = async (req, res) => {
  try {
    const faqs = await ChatFaq.getRootFaqs();
    res.json(faqs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── User: get children of a question ─────────────────────────
exports.getChildren = async (req, res) => {
  try {
    const children = await ChatFaq.getChildFaqs(req.params.parentId);
    const parent = await ChatFaq.getById(req.params.parentId);
    res.json({ parent, children });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: get all FAQs ───────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const faqs = await ChatFaq.getAll();
    res.json(faqs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: create FAQ ─────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { question, answer, parent_id, order_num } = req.body;
    if (!question || !answer) {
      return res
        .status(400)
        .json({ message: "Question and answer are required" });
    }
    const id = await ChatFaq.create({
      question,
      answer,
      parent_id: parent_id || null,
      order_num: order_num || 0,
    });
    res.status(201).json({ id, message: "FAQ created" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: update FAQ ─────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const affected = await ChatFaq.update(req.params.id, req.body);
    if (!affected) return res.status(404).json({ message: "FAQ not found" });
    res.json({ message: "FAQ updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: delete FAQ ─────────────────────────────────────────
exports.delete = async (req, res) => {
  try {
    const affected = await ChatFaq.delete(req.params.id);
    if (!affected) return res.status(404).json({ message: "FAQ not found" });
    res.json({ message: "FAQ deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
