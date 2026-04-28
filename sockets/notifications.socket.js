import { supabaseAdmin } from "../config/supabase.admin.js";

const saveNotification = async ({ userId, type, title, body, data = {} }) => {
  const { data: notification, error } = await supabaseAdmin
    .from("notifications")
    .insert({
      user_id: userId,
      type,
      title,
      message: body,
      data,
      is_read: false,
    })
    .select()
    .single();

  if (error) {
    console.log("❌ Notification save error:", error.message);
    return null;
  }

  return notification;
};

const emitToUser = (io, userId, event, payload) => {
  if (!userId) return;
  io.to(`user:${userId}`).emit(event, payload);
};

export const notificationsSocket = (io) => {
  io.on("connection", (socket) => {
    const currentUserId = socket.user?.id;

    if (!currentUserId) {
      console.log("❌ No user ID for notifications socket");
      return;
    }

    socket.join(`user:${currentUserId}`);

    console.log("🔔 Notifications connected:", currentUserId);

    socket.on("notification:send", async (payload) => {
      console.log(payload, "new message");
      const { userId: targetUserId, type, title, body, data = {} } = payload;

      if (!targetUserId || !type) return;

      const notification = await saveNotification({
        userId: targetUserId,
        type,
        title,
        body,
        data,
      });

      if (!notification) return;

      emitToUser(io, targetUserId, "notification:new", notification);
    });

    socket.on("notification:read", async ({ notificationId }) => {
      if (!notificationId) return;

      const { data, error } = await supabaseAdmin
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId)
        .select()
        .single();

      if (error) return;

      socket.emit("notification:updated", data);
    });

    socket.on("notification:read_all", async () => {
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ read: true })
        .eq("user_id", currentUserId)
        .eq("read", false);

      if (error) return;

      socket.emit("notification:all_read");
    });

    socket.on("proposal:created", async ({ receiverId, proposal }) => {
      const notification = await saveNotification({
        userId: receiverId,
        type: "proposal_received",
        title: "New Skill Proposal",
        body: `${socket.user.name} sent you a proposal`,
        data: { proposalId: proposal.id },
      });

      emitToUser(io, receiverId, "notification:new", notification);
    });

    socket.on("proposal:updated", async ({ receiverId, proposal }) => {
      const notification = await saveNotification({
        userId: receiverId,
        type: "proposal_updated",
        title: "Proposal Updated",
        body: `Proposal status: ${proposal.status}`,
        data: { proposalId: proposal.id },
      });

      emitToUser(io, receiverId, "notification:new", notification);
    });

    socket.on("disconnect", () => {
      console.log("🔴 Notifications disconnected:", currentUserId);
    });
  });
};
