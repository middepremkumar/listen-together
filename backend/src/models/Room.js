const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true, maxlength: 30 },
    picture: { type: String, default: '' },
    isHost: { type: Boolean, default: false },
    connected: { type: Boolean, default: true }
  },
  { _id: false }
);

const QueueItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    videoId: { type: String, required: true },
    title: { type: String, default: 'Untitled video', maxlength: 200 },
    thumbnail: { type: String, default: '' },
    duration: { type: Number, default: 0 },
    addedBy: { type: String, default: 'Unknown' },
    addedByUserId: { type: String, default: '' },
    addedByPicture: { type: String, default: '' },
    addedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ChatMessageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['chat', 'system'], default: 'chat' },
    sender: { type: String, default: 'System' },
    senderId: { type: String, default: '' },
    senderPicture: { type: String, default: '' },
    text: { type: String, required: true, maxlength: 500 },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const RoomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    hostUserId: { type: String, default: null },
    members: { type: [MemberSchema], default: [] },
    queue: { type: [QueueItemSchema], default: [] },
    currentVideo: {
      videoId: { type: String, default: null },
      title: { type: String, default: '' },
      thumbnail: { type: String, default: '' },
      duration: { type: Number, default: 0 },
      position: { type: Number, default: 0 },
      isPlaying: { type: Boolean, default: false },
      updatedAt: { type: Date, default: Date.now }
    },
    settings: {
      locked: { type: Boolean, default: false },
      maxMembers: { type: Number, default: 25 },
      hasPassword: { type: Boolean, default: false },
      password: { type: String, default: null }
    },
    chatHistory: { type: [ChatMessageSchema], default: [] },
    lastActivity: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

RoomSchema.index({ lastActivity: 1 });

module.exports = mongoose.model('Room', RoomSchema);
