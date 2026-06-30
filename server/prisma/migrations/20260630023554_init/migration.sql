-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'autonomous',
    "status" TEXT NOT NULL DEFAULT 'running',
    "companyUrl" TEXT,
    "optionalDescription" TEXT,
    "businessIdea" TEXT,
    "targetCustomer" TEXT,
    "recommendation" TEXT,
    "sharedPatterns" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentStep" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "nodeName" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "reasoning" TEXT,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCheckpoint" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AgentCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "snippet" TEXT,
    "text" TEXT,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "sourceId" TEXT,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "evidence" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gap" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Gap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentStep_agentRunId_idx" ON "AgentStep"("agentRunId");

-- CreateIndex
CREATE INDEX "AgentCheckpoint_agentRunId_idx" ON "AgentCheckpoint"("agentRunId");

-- CreateIndex
CREATE INDEX "Competitor_agentRunId_idx" ON "Competitor"("agentRunId");

-- CreateIndex
CREATE INDEX "Source_competitorId_idx" ON "Source"("competitorId");

-- CreateIndex
CREATE INDEX "Claim_competitorId_idx" ON "Claim"("competitorId");

-- CreateIndex
CREATE INDEX "Claim_sourceId_idx" ON "Claim"("sourceId");

-- CreateIndex
CREATE INDEX "Gap_agentRunId_idx" ON "Gap"("agentRunId");

-- AddForeignKey
ALTER TABLE "AgentStep" ADD CONSTRAINT "AgentStep_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCheckpoint" ADD CONSTRAINT "AgentCheckpoint_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gap" ADD CONSTRAINT "Gap_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
