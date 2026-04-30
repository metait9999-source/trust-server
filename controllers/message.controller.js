// message.controller.js file
const Message = require("../models/message.model");
const Conversation = require("../models/conversation.model");
const ChatFaq = require("../models/chatFaq.model");
const { v4: uuidv4 } = require("uuid");
const { getReceiverSocketId, io } = require("../socket/socket");

// Send a new message
exports.sendMessage = async (req, res) => {
  const { userId, recipientId, messageText, senderType } = req.body;
  const messageImage = req.file ? req.file.path : null;

  try {
    let anonymousSenderId = null;
    let conversation_id = null;

    // Check if the sender is anonymous
    if (!userId && senderType !== "admin") {
      anonymousSenderId = uuidv4();
    }

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

        // ✅ Emit to USER
        const userSocketId = getReceiverSocketId(newMessage.sender_id);
        if (userSocketId) {
          io.to(userSocketId).emit("newMessage", parsedFaqReply);
        }

        // ✅ Emit to ADMIN so it appears in their conversation panel too
        const adminSocketId = getReceiverSocketId(0); // 0 = admin
        if (adminSocketId) {
          io.to(adminSocketId).emit("newMessage", parsedFaqReply);
        }
      }
    }

    // Determine if a conversation already exists
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

    // If no conversation exists, create a new one
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

    // Insert the user's/admin's message into the database
    const newMessage = await Message.createMessage({
      conversation_id,
      sender_id: userId || null,
      anonymous_sender_id: anonymousSenderId,
      message_text: messageText,
      message_image: messageImage,
      seen: 0,
      sender_type: senderType || "user",
    });

    // Emit the new message to the client
    const receiverSocketId = getReceiverSocketId(recipientId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    // Emit unread message count
    const unreadConversationsCount =
      await Message.getUnreadConversationsCount();
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("getUnreadMessage", {
        unreadConversationsCount,
      });
    }

    // ── Auto-reply on first message from user ─────────────────
    const previousMessages = await Message.getMessagesByConversationId(
      newMessage.conversation_id,
    );

    if (previousMessages.length === 1 && senderType === "user") {
      // Get root FAQs
      const rootFaqs = await ChatFaq.getRootFaqs();

      let replyText =
        "Thank you for reaching out! 👋 Our team will contact you soon.";
      if (rootFaqs.length > 0) {
        replyText +=
          "\n\nMeanwhile, you can select a topic below for instant help:";
      }

      const defaultReply = {
        conversation_id: newMessage.conversation_id,
        sender_id: null,
        message_text: replyText,
        message_image: null,
        seen: 0,
        sender_type: "admin",
        faq_options: rootFaqs.length > 0 ? JSON.stringify(rootFaqs) : null,
      };

      const defaultReplyMessage = await Message.createMessage(defaultReply);

      // Emit to user — send faq_options as parsed array not string
      const userSocketId = getReceiverSocketId(
        newMessage.sender_id || recipientId,
      );
      if (userSocketId) {
        io.to(userSocketId).emit("newMessage", {
          ...defaultReplyMessage,
          faq_options: rootFaqs,
        });
      }
    }

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all messages in a conversation
exports.getMessages = async (req, res) => {
  const { conversation_id, user_id } = req.params;

  try {
    const messages = await Message.getMessagesByConversationId(
      conversation_id,
      user_id,
    );

    // Mark messages as seen
    await Message.markMessagesAsSeen(conversation_id, user_id);

    const receiverSocketId = getReceiverSocketId(0);
    const unreadConversationsCount =
      await Message.getUnreadConversationsCount();

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("getUnreadMessage", {
        unreadConversationsCount,
      });
    }

    // ✅ Parse faq_options JSON string back to array for each message
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

// Get all conversations with the last message
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
