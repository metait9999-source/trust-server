const Message = require("../models/message.model");
const Conversation = require("../models/conversation.model");
const ChatFaq = require("../models/chatFaq.model");
const { v4: uuidv4 } = require("uuid");
const { getReceiverSocketId, io } = require("../socket/socket");

// ── Send message ───────────────────────────────────────────
exports.sendMessage = async (req, res) => {
  const { userId, recipientId, messageText, senderType, faq_id } = req.body;
  const messageImage = req.file ? req.file.path : null;

  try {
    let anonymousSenderId = null;
    let conversation_id = null;

    if (!userId && senderType !== "admin") {
      anonymousSenderId = uuidv4();
    }

    if (senderType === "user" || senderType === "admin") {
      if (senderType === "user") {
        conversation_id = await Conversation.findConversationByUserIds(
          userId,
          0,
        );
      } else {
        conversation_id = await Conversation.findConversationByUserIds(
          recipientId,
          0,
        );
      }
    } else {
      conversation_id = await Conversation.findConversationForAnonymous(
        anonymousSenderId,
        0,
      );
    }

    if (!conversation_id) {
      if (senderType === "user" || senderType === "admin") {
        if (senderType === "user") {
          conversation_id = await Conversation.createConversation(userId, 0);
        } else {
          conversation_id = await Conversation.createConversation(
            recipientId,
            0,
          );
        }
      } else {
        conversation_id = await Conversation.createConversationForAnonymous(
          anonymousSenderId,
          0,
        );
      }
    }

    const newMessage = await Message.createMessage({
      conversation_id,
      sender_id: userId || null,
      anonymous_sender_id: anonymousSenderId,
      message_text: messageText,
      message_image: messageImage,
      seen: 0,
      sender_type: senderType || "user",
    });

    // ── Emit new message to recipient ──────────────────────
    const receiverSocketId = getReceiverSocketId(recipientId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    // ── Emit unread count ──────────────────────────────────
    const unreadConversationsCount =
      await Message.getUnreadConversationsCount();
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("getUnreadMessage", {
        unreadConversationsCount,
      });
    }

    // ── Auto-reply on first message from user ──────────────
    const previousMessages = await Message.getMessagesByConversationId(
      newMessage.conversation_id,
    );

    if (previousMessages.length === 1 && senderType === "user") {
      const rootFaqs = await ChatFaq.getRootFaqs();

      let replyText =
        "Thank you for reaching out! 👋 Our team will contact you soon.";
      if (rootFaqs.length > 0) {
        replyText +=
          "\n\nMeanwhile, you can select a topic below for instant help:";
      }

      const defaultReplyMessage = await Message.createMessage({
        conversation_id: newMessage.conversation_id,
        sender_id: null,
        anonymous_sender_id: null,
        message_text: replyText,
        message_image: null,
        seen: 0,
        sender_type: "admin",
        faq_options: rootFaqs.length > 0 ? JSON.stringify(rootFaqs) : null,
      });

      const parsedDefaultReply = {
        ...defaultReplyMessage,
        faq_options: rootFaqs.length > 0 ? rootFaqs : null,
      };

      const userSocketId = getReceiverSocketId(
        newMessage.sender_id || recipientId,
      );
      if (userSocketId)
        io.to(userSocketId).emit("newMessage", parsedDefaultReply);

      const adminSocketId = getReceiverSocketId(0);
      if (adminSocketId)
        io.to(adminSocketId).emit("newMessage", parsedDefaultReply);
    }

    // ── FAQ auto-reply ─────────────────────────────────────
    if (senderType === "user" && faq_id) {
      const faq = await ChatFaq.getFaqWithChildren(faq_id);

      if (faq) {
        let replyText = faq.answer || "Here's some information on that topic.";
        if (faq.children && faq.children.length > 0) {
          replyText += "\n\nYou can also explore a sub-topic below:";
        }

        const faqReplyMessage = await Message.createMessage({
          conversation_id: newMessage.conversation_id,
          sender_id: null,
          anonymous_sender_id: null,
          message_text: replyText,
          message_image: null,
          seen: 0,
          sender_type: "admin",
          faq_options:
            faq.children && faq.children.length > 0
              ? JSON.stringify(faq.children)
              : null,
        });

        const parsedFaqReply = {
          ...faqReplyMessage,
          faq_options: faq.children?.length > 0 ? faq.children : null,
        };

        const userSocketId = getReceiverSocketId(newMessage.sender_id);
        if (userSocketId)
          io.to(userSocketId).emit("newMessage", parsedFaqReply);

        const adminSocketId = getReceiverSocketId(0);
        if (adminSocketId)
          io.to(adminSocketId).emit("newMessage", parsedFaqReply);
      }
    }

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Get messages ───────────────────────────────────────────
exports.getMessages = async (req, res) => {
  const { conversation_id, user_id } = req.params;

  try {
    const messages = await Message.getMessagesByConversationId(
      conversation_id,
      user_id,
    );

    // ── Mark as seen + capture timestamp ──────────────────
    await Message.markMessagesAsSeen(conversation_id, user_id);
    const seenAt = new Date().toISOString();

    // ── Emit messagesSeen with timestamp to original sender ─
    // user_id === "0" means admin is reading → notify the user
    // otherwise user is reading → notify the admin (id=0)
    const otherPartyMessage = messages.find(
      (m) => String(m.sender_id) !== String(user_id) && m.sender_id !== null,
    );

    if (otherPartyMessage) {
      const otherPartyId =
        user_id === "0"
          ? otherPartyMessage.sender_id // admin reading → tell user
          : 0; // user reading → tell admin

      const otherSocketId = getReceiverSocketId(otherPartyId);
      if (otherSocketId) {
        io.to(otherSocketId).emit("messagesSeen", {
          conversation_id: Number(conversation_id),
          seen_at: seenAt,
        });
      }
    }

    // ── Update unread count for admin ──────────────────────
    const receiverSocketId = getReceiverSocketId(0);
    const unreadConversationsCount =
      await Message.getUnreadConversationsCount();
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("getUnreadMessage", {
        unreadConversationsCount,
      });
    }

    // ── Parse faq_options ──────────────────────────────────
    const parsedMessages = messages.map((msg) => ({
      ...msg,
      faq_options: msg.faq_options
        ? typeof msg.faq_options === "string"
          ? JSON.parse(msg.faq_options)
          : msg.faq_options
        : null,
    }));

    res.status(200).json(parsedMessages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get all conversations ──────────────────────────────────
exports.getAllConversations = async (req, res) => {
  try {
    const conversations = await Conversation.getAll();
    for (let conversation of conversations) {
      const lastMessage = await Message.getLastMessageByConversationId(
        conversation.id,
      );
      conversation.last_message = lastMessage;
    }
    res.status(200).json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
