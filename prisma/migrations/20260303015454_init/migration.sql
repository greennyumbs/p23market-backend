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
