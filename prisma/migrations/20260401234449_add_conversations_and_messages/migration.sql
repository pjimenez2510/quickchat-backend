-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'VOICE', 'GIF', 'STICKER', 'FILE');

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "participant1_id" TEXT NOT NULL,
    "participant2_id" TEXT NOT NULL,
    "last_message_id" TEXT,
    "archived_by" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "marked_unread_by" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "media_url" TEXT,
    "reply_to_id" TEXT,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "edited_at" TIMESTAMP(3),
    "deleted_for_all" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deleted_messages" (
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_messages_pkey" PRIMARY KEY ("message_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_last_message_id_key" ON "conversations"("last_message_id");

-- CreateIndex
CREATE INDEX "conversations_participant1_id_idx" ON "conversations"("participant1_id");

-- CreateIndex
CREATE INDEX "conversations_participant2_id_idx" ON "conversations"("participant2_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_participant1_id_participant2_id_key" ON "conversations"("participant1_id", "participant2_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_is_pinned_idx" ON "messages"("conversation_id", "is_pinned");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant1_id_fkey" FOREIGN KEY ("participant1_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant2_id_fkey" FOREIGN KEY ("participant2_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_last_message_id_fkey" FOREIGN KEY ("last_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deleted_messages" ADD CONSTRAINT "deleted_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deleted_messages" ADD CONSTRAINT "deleted_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
