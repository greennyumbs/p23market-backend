-- CreateEnum
CREATE TYPE "MiniGameMode" AS ENUM ('TEAM_RPS_VOTE', 'MAJORITY_DIE');

-- CreateEnum
CREATE TYPE "MiniGameRoomStatus" AS ENUM ('WAITING', 'PLAYING', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeamSide" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "MiniGameRoundStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "RpsChoice" AS ENUM ('ROCK', 'PAPER', 'SCISSORS');

-- CreateEnum
CREATE TYPE "MajorityDieChoice" AS ENUM ('LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "MajorityDieResolutionReason" AS ENUM ('MINORITY_SURVIVE', 'TIE_REPLAY', 'SINGLE_SIDE_REPLAY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'TEAM_RPS_VOTE_ESCROW';
ALTER TYPE "TransactionType" ADD VALUE 'TEAM_RPS_VOTE_PAYOUT';
ALTER TYPE "TransactionType" ADD VALUE 'TEAM_RPS_VOTE_REFUND';
ALTER TYPE "TransactionType" ADD VALUE 'MAJORITY_DIE_ESCROW';
ALTER TYPE "TransactionType" ADD VALUE 'MAJORITY_DIE_PAYOUT';
ALTER TYPE "TransactionType" ADD VALUE 'MAJORITY_DIE_REFUND';

-- CreateTable
CREATE TABLE "mini_game_rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "mode" "MiniGameMode" NOT NULL,
    "status" "MiniGameRoomStatus" NOT NULL DEFAULT 'WAITING',
    "hostUserId" TEXT NOT NULL,
    "entryStake" INTEGER NOT NULL,
    "stake" INTEGER NOT NULL DEFAULT 0,
    "minPlayers" INTEGER NOT NULL DEFAULT 4,
    "maxPlayers" INTEGER NOT NULL DEFAULT 10,
    "stageTimeoutSec" INTEGER NOT NULL DEFAULT 15,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "scoreA" INTEGER NOT NULL DEFAULT 0,
    "scoreB" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mini_game_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mini_game_participants" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "team" "TeamSide",
    "alive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "mini_game_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mini_game_rounds" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "MiniGameRoundStatus" NOT NULL DEFAULT 'OPEN',
    "inputStartedAt" TIMESTAMP(3) NOT NULL,
    "inputEndsAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "teamChoiceA" "RpsChoice",
    "teamChoiceB" "RpsChoice",
    "teamTieBreakA" BOOLEAN NOT NULL DEFAULT false,
    "teamTieBreakB" BOOLEAN NOT NULL DEFAULT false,
    "countRockA" INTEGER NOT NULL DEFAULT 0,
    "countPaperA" INTEGER NOT NULL DEFAULT 0,
    "countScissorsA" INTEGER NOT NULL DEFAULT 0,
    "countRockB" INTEGER NOT NULL DEFAULT 0,
    "countPaperB" INTEGER NOT NULL DEFAULT 0,
    "countScissorsB" INTEGER NOT NULL DEFAULT 0,
    "roundWinner" "TeamSide",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mini_game_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mini_game_round_submissions" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "choice" "RpsChoice" NOT NULL,
    "autoPicked" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mini_game_round_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "majority_die_stages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "stageNumber" INTEGER NOT NULL,
    "status" "MiniGameRoundStatus" NOT NULL DEFAULT 'OPEN',
    "inputStartedAt" TIMESTAMP(3) NOT NULL,
    "inputEndsAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "pickLeftCount" INTEGER NOT NULL DEFAULT 0,
    "pickRightCount" INTEGER NOT NULL DEFAULT 0,
    "minoritySide" "MajorityDieChoice",
    "resolutionReason" "MajorityDieResolutionReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "majority_die_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "majority_die_stage_submissions" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "choice" "MajorityDieChoice" NOT NULL,
    "autoPicked" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "majority_die_stage_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mini_game_rooms_mode_status_idx" ON "mini_game_rooms"("mode", "status");

-- CreateIndex
CREATE INDEX "mini_game_rooms_hostUserId_idx" ON "mini_game_rooms"("hostUserId");

-- CreateIndex
CREATE INDEX "mini_game_rooms_createdAt_idx" ON "mini_game_rooms"("createdAt");

-- CreateIndex
CREATE INDEX "mini_game_participants_roomId_idx" ON "mini_game_participants"("roomId");

-- CreateIndex
CREATE INDEX "mini_game_participants_userId_idx" ON "mini_game_participants"("userId");

-- CreateIndex
CREATE INDEX "mini_game_participants_team_idx" ON "mini_game_participants"("team");

-- CreateIndex
CREATE UNIQUE INDEX "mini_game_participants_roomId_userId_key" ON "mini_game_participants"("roomId", "userId");

-- CreateIndex
CREATE INDEX "mini_game_rounds_roomId_status_idx" ON "mini_game_rounds"("roomId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mini_game_rounds_roomId_roundNumber_key" ON "mini_game_rounds"("roomId", "roundNumber");

-- CreateIndex
CREATE INDEX "mini_game_round_submissions_roundId_idx" ON "mini_game_round_submissions"("roundId");

-- CreateIndex
CREATE INDEX "mini_game_round_submissions_participantId_idx" ON "mini_game_round_submissions"("participantId");

-- CreateIndex
CREATE INDEX "mini_game_round_submissions_userId_idx" ON "mini_game_round_submissions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mini_game_round_submissions_roundId_participantId_key" ON "mini_game_round_submissions"("roundId", "participantId");

-- CreateIndex
CREATE INDEX "majority_die_stages_roomId_status_idx" ON "majority_die_stages"("roomId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "majority_die_stages_roomId_stageNumber_key" ON "majority_die_stages"("roomId", "stageNumber");

-- CreateIndex
CREATE INDEX "majority_die_stage_submissions_stageId_idx" ON "majority_die_stage_submissions"("stageId");

-- CreateIndex
CREATE INDEX "majority_die_stage_submissions_participantId_idx" ON "majority_die_stage_submissions"("participantId");

-- CreateIndex
CREATE INDEX "majority_die_stage_submissions_userId_idx" ON "majority_die_stage_submissions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "majority_die_stage_submissions_stageId_participantId_key" ON "majority_die_stage_submissions"("stageId", "participantId");

-- CreateIndex
CREATE INDEX "arena_matches_ownerId_idx" ON "arena_matches"("ownerId");

-- CreateIndex
CREATE INDEX "arena_matches_challengerId_idx" ON "arena_matches"("challengerId");

-- CreateIndex
CREATE INDEX "arena_matches_winnerUserId_idx" ON "arena_matches"("winnerUserId");

-- CreateIndex
CREATE INDEX "arena_matches_resolvedAt_idx" ON "arena_matches"("resolvedAt");

-- CreateIndex
CREATE INDEX "arena_rooms_status_idx" ON "arena_rooms"("status");

-- CreateIndex
CREATE INDEX "arena_rooms_ownerId_idx" ON "arena_rooms"("ownerId");

-- CreateIndex
CREATE INDEX "arena_rooms_createdAt_idx" ON "arena_rooms"("createdAt");

-- CreateIndex
CREATE INDEX "settlement_snapshots_settlementId_idx" ON "settlement_snapshots"("settlementId");

-- CreateIndex
CREATE INDEX "settlement_snapshots_userId_idx" ON "settlement_snapshots"("userId");

-- CreateIndex
CREATE INDEX "settlements_createdAt_idx" ON "settlements"("createdAt");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "transactions_fromUserId_idx" ON "transactions"("fromUserId");

-- CreateIndex
CREATE INDEX "transactions_toUserId_idx" ON "transactions"("toUserId");

-- CreateIndex
CREATE INDEX "transactions_createdAt_idx" ON "transactions"("createdAt");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- AddForeignKey
ALTER TABLE "mini_game_rooms" ADD CONSTRAINT "mini_game_rooms_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_game_participants" ADD CONSTRAINT "mini_game_participants_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "mini_game_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_game_participants" ADD CONSTRAINT "mini_game_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_game_rounds" ADD CONSTRAINT "mini_game_rounds_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "mini_game_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_game_round_submissions" ADD CONSTRAINT "mini_game_round_submissions_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "mini_game_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_game_round_submissions" ADD CONSTRAINT "mini_game_round_submissions_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "mini_game_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_game_round_submissions" ADD CONSTRAINT "mini_game_round_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "majority_die_stages" ADD CONSTRAINT "majority_die_stages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "mini_game_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "majority_die_stage_submissions" ADD CONSTRAINT "majority_die_stage_submissions_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "majority_die_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "majority_die_stage_submissions" ADD CONSTRAINT "majority_die_stage_submissions_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "mini_game_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "majority_die_stage_submissions" ADD CONSTRAINT "majority_die_stage_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
